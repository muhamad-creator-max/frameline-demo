import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUploadPlayback } from "@/lib/mux/client";

export const runtime = "nodejs";

/**
 * GET /api/uploads/mux/status?uploadId=...
 *
 * Polled by the builder/client flow to discover when a Mux upload has
 * finished processing. When the asset is ready we ALSO upgrade any option
 * rows that still point at the upload id — this is the webhook's
 * fallback path for environments where Mux can't reach us (localhost).
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
      const { data: opts } = await admin
        .from("options")
        .select("id, media_meta")
        .eq("media_provider", "mux")
        .eq("media_url", uploadId);

      for (const opt of opts ?? []) {
        const meta = {
          ...((opt.media_meta as Record<string, unknown>) ?? {}),
          status: "ready",
          duration_s: info.duration ?? null,
          aspect_ratio: info.aspectRatio ?? null,
          asset_id: info.assetId,
          upload_id: uploadId,
        };
        await admin
          .from("options")
          .update({ media_url: info.playbackId, media_meta: meta as never })
          .eq("id", opt.id);
      }
    }

    return NextResponse.json(info);
  } catch (e) {
    console.error("[mux/status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "lookup failed" },
      { status: 500 },
    );
  }
}
