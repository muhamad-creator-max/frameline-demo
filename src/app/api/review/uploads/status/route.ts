import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUploadPlayback } from "@/lib/mux/client";

export const runtime = "nodejs";

/**
 * GET /api/review/uploads/status?uploadId=...
 *
 * Polling fallback for environments where the Mux webhook can't reach us
 * (localhost). When the asset is ready, reconcile the matching
 * review_asset_versions row — the same upgrade the webhook performs.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const uploadId = new URL(req.url).searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  try {
    const info = await getUploadPlayback(uploadId);

    if (info.status === "ready" && info.playbackId) {
      const admin = createAdminClient();
      const aspect = parseAspect(info.aspectRatio);
      await admin
        .from("review_asset_versions")
        .update({
          status: "ready",
          mux_playback_id: info.playbackId,
          mux_asset_id: info.assetId ?? null,
          duration_s: info.duration ?? null,
          aspect_ratio: info.aspectRatio ?? null,
          width: aspect?.w ?? null,
          height: aspect?.h ?? null,
          thumbnail_url: `https://image.mux.com/${info.playbackId}/thumbnail.jpg?width=640`,
        })
        .eq("mux_upload_id", uploadId);
    } else if (info.status === "errored") {
      const admin = createAdminClient();
      await admin
        .from("review_asset_versions")
        .update({ status: "errored" })
        .eq("mux_upload_id", uploadId);
    }

    return NextResponse.json(info);
  } catch (e) {
    console.error("[review/uploads/status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "lookup failed" },
      { status: 500 },
    );
  }
}

function parseAspect(aspect?: string): { w: number; h: number } | null {
  if (!aspect) return null;
  const [w, h] = aspect.split(":").map((n) => parseInt(n, 10));
  if (!w || !h) return null;
  return { w, h };
}
