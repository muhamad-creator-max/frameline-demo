import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSharedProject } from "@/lib/review/guest";

export const runtime = "nodejs";

/**
 * GET /api/review/r/[slug]/download/[versionId]
 * Redirects to a downloadable URL for the version — only if the project has
 * downloads enabled. For Mux video this is the static MP4 rendition; for
 * storage/bunny it's a signed/CDN URL. 403 when downloads are disabled.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; versionId: string }> },
) {
  const { slug, versionId } = await params;

  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.allow_download) return NextResponse.json({ error: "downloads disabled" }, { status: 403 });

  const admin = createAdminClient();
  const { data: versionRaw } = await admin
    .from("review_asset_versions")
    .select("id, provider, mux_playback_id, file_url, asset:review_assets!inner(project_id, deleted_at)")
    .eq("id", versionId)
    .maybeSingle();

  // Embedded relations aren't represented in our hand-written types, so narrow here.
  const version = versionRaw as {
    id: string;
    provider: "mux" | "bunny" | "storage";
    mux_playback_id: string | null;
    file_url: string | null;
    asset: { project_id: string; deleted_at: string | null } | null;
  } | null;

  const asset = version?.asset;
  if (!version || asset?.project_id !== project.id || asset?.deleted_at) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let url: string | null = null;
  if (version.provider === "mux" && version.mux_playback_id) {
    // Static MP4 rendition (requires mp4_support on the asset; "capped-1080p" is broadly available).
    url = `https://stream.mux.com/${version.mux_playback_id}/capped-1080p.mp4?download=video`;
  } else if (version.file_url) {
    if (version.provider === "storage") {
      const { data } = await admin.storage
        .from("review-media")
        .createSignedUrl(version.file_url, 60 * 10, { download: true });
      url = data?.signedUrl ?? null;
    } else {
      url = version.file_url;
    }
  }

  if (!url) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return NextResponse.redirect(url);
}
