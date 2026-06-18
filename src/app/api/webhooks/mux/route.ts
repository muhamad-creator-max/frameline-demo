import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Mux webhook handler.
 *   - video.upload.asset_created       → store provisional asset
 *   - video.asset.ready                → mark playback ready, update options.media_meta
 *
 * Signature verification per https://docs.mux.com/core/listen-for-webhooks
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("mux-signature") ?? "";
  const secret = process.env.MUX_WEBHOOK_SECRET;

  if (secret && !verifyMuxSignature(body, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body) as {
    id: string;
    type: string;
    data: Record<string, unknown>;
  };

  const supabase = createAdminClient();

  // idempotency
  const { data: existing } = await supabase
    .from("webhook_events" as never)
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, dedup: true });

  await supabase.from("webhook_events" as never).insert({
    id: event.id,
    provider: "mux",
    type: event.type,
    payload: event,
  });

  if (event.type === "video.asset.ready") {
    const data = event.data as {
      id: string;
      upload_id?: string;
      playback_ids?: { id: string; policy: string }[];
      duration?: number;
      aspect_ratio?: string;
      passthrough?: string;
    };
    const playbackId = data.playback_ids?.[0]?.id;
    const uploadId = data.upload_id;

    if (playbackId && uploadId) {
      // Reconcile: any option row whose media_url still points at the upload id
      // gets swapped to the playback id, plus duration/aspect into media_meta.
      const { data: opts } = await supabase
        .from("options")
        .select("id, media_meta")
        .eq("media_provider", "mux")
        .eq("media_url", uploadId);

      for (const opt of opts ?? []) {
        const meta = {
          ...(opt.media_meta ?? {}),
          status: "ready",
          duration_s: data.duration ?? null,
          aspect_ratio: data.aspect_ratio ?? null,
          asset_id: data.id,
          upload_id: uploadId,
        };
        await supabase
          .from("options")
          .update({ media_url: playbackId, media_meta: meta as never })
          .eq("id", opt.id);
      }
      console.log(`[mux] reconciled ${opts?.length ?? 0} option(s) for upload ${uploadId} → ${playbackId}`);

      // Video Review: flip the matching asset version to ready.
      const aspect = parseAspect(data.aspect_ratio);
      const { data: versions } = await supabase
        .from("review_asset_versions")
        .update({
          status: "ready",
          mux_playback_id: playbackId,
          mux_asset_id: data.id,
          duration_s: data.duration ?? null,
          aspect_ratio: data.aspect_ratio ?? null,
          width: aspect?.w ?? null,
          height: aspect?.h ?? null,
          thumbnail_url: `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640`,
        })
        .eq("mux_upload_id", uploadId)
        .select("id");
      if (versions?.length) {
        console.log(`[mux] review version(s) ready for upload ${uploadId} → ${playbackId}`);
      }
    }
  }

  if (event.type === "video.asset.errored" || event.type === "video.upload.errored") {
    const data = event.data as { id?: string; upload_id?: string };
    const uploadId = data.upload_id ?? data.id;
    if (uploadId) {
      await supabase
        .from("review_asset_versions")
        .update({ status: "errored" })
        .eq("mux_upload_id", uploadId);
    }
  }

  return NextResponse.json({ ok: true });
}

/** Parse Mux's "16:9" aspect string into nominal width/height (kept for layout hints). */
function parseAspect(aspect?: string): { w: number; h: number } | null {
  if (!aspect) return null;
  const [w, h] = aspect.split(":").map((n) => parseInt(n, 10));
  if (!w || !h) return null;
  return { w, h };
}

function verifyMuxSignature(body: string, header: string, secret: string) {
  // Header format: "t=...,v1=..."
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const payload = `${t}.${body}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}
