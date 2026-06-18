import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDirectUpload } from "@/lib/mux/client";

export const runtime = "nodejs";

/**
 * POST /api/review/uploads/mux  →  { uploadUrl, uploadId, assetId, versionId }
 *
 * Body: { projectId, folderId?, name?, assetId? }
 *   - No assetId  → create a brand-new asset + its V1 version.
 *   - With assetId → add the NEXT version to an existing asset (Frame.io versions).
 *
 * Creates the rows first (version status 'uploading'), then a Mux direct upload
 * whose passthrough carries the versionId so the webhook/poller can reconcile.
 * Auth: editor must own the project.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { projectId, folderId, name, assetId } = await req.json().catch(() => ({}));
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Verify ownership of the project.
  const { data: project } = await supabase
    .from("review_projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  let resolvedAssetId = assetId as string | undefined;
  let version = 1;

  if (resolvedAssetId) {
    // New version on an existing asset — confirm it belongs to this project.
    const { data: asset } = await supabase
      .from("review_assets")
      .select("id, current_version, kind, project_id")
      .eq("id", resolvedAssetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });
    if (asset.kind !== "video") {
      return NextResponse.json({ error: "asset is not a video" }, { status: 400 });
    }
    version = asset.current_version + 1;
    await supabase
      .from("review_assets")
      .update({ current_version: version })
      .eq("id", resolvedAssetId);
  } else {
    // Brand-new video asset.
    const { data: asset, error: assetErr } = await supabase
      .from("review_assets")
      .insert({
        project_id: projectId,
        folder_id: folderId ?? null,
        kind: "video",
        name: name?.trim() || "Untitled video",
        current_version: 1,
      })
      .select("id")
      .single();
    if (assetErr || !asset) {
      return NextResponse.json({ error: assetErr?.message ?? "create failed" }, { status: 500 });
    }
    resolvedAssetId = asset.id;
  }

  // Create the version row (status 'uploading').
  const { data: ver, error: verErr } = await supabase
    .from("review_asset_versions")
    .insert({
      asset_id: resolvedAssetId!,
      version,
      status: "uploading",
      provider: "mux",
    })
    .select("id")
    .single();
  if (verErr || !ver) {
    return NextResponse.json({ error: verErr?.message ?? "version failed" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const upload = await createDirectUpload({
    corsOrigin: origin,
    passthrough: JSON.stringify({ kind: "review", versionId: ver.id, projectId, userId: user.id }),
    mp4Support: true,
  });

  // Record the upload id so the webhook/poller can find this version.
  await supabase
    .from("review_asset_versions")
    .update({ mux_upload_id: upload.uploadId })
    .eq("id", ver.id);

  return NextResponse.json({
    uploadUrl: upload.uploadUrl,
    uploadId: upload.uploadId,
    assetId: resolvedAssetId,
    versionId: ver.id,
  });
}
