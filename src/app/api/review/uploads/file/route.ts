import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB (images/audio)
const BUCKET = "review-media";

/**
 * POST /api/review/uploads/file  (multipart/form-data)
 *   Fields: file, projectId, folderId?, kind: 'image' | 'audio', assetId?
 *
 * Uploads non-streaming media (images, audio) to the private review-media
 * bucket via the service role, then creates the asset + a READY version
 * pointing at the storage object path. Video goes through the Mux route instead.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const projectId = form.get("projectId") as string | null;
  const folderId = (form.get("folderId") as string) || null;
  const assetId = (form.get("assetId") as string) || null;
  const kind = (form.get("kind") as string) || "image";

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (kind !== "image" && kind !== "audio") {
    return NextResponse.json({ error: "kind must be image or audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large" }, { status: 413 });

  // Ownership check.
  const { data: project } = await supabase
    .from("review_projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${projectId}/${newId()}-${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Create / version the asset.
  let resolvedAssetId = assetId ?? undefined;
  let version = 1;

  if (resolvedAssetId) {
    const { data: asset } = await supabase
      .from("review_assets")
      .select("id, current_version, project_id")
      .eq("id", resolvedAssetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });
    version = asset.current_version + 1;
    await supabase.from("review_assets").update({ current_version: version }).eq("id", resolvedAssetId);
  } else {
    const { data: asset, error: assetErr } = await supabase
      .from("review_assets")
      .insert({
        project_id: projectId,
        folder_id: folderId,
        kind: kind as "image" | "audio",
        name: file.name,
        current_version: 1,
      })
      .select("id")
      .single();
    if (assetErr || !asset) {
      return NextResponse.json({ error: assetErr?.message ?? "create failed" }, { status: 500 });
    }
    resolvedAssetId = asset.id;
  }

  // Public-read is off; store the object path. Reads generate a signed URL.
  const { data: ver, error: verErr } = await supabase
    .from("review_asset_versions")
    .insert({
      asset_id: resolvedAssetId!,
      version,
      status: "ready",
      provider: "storage",
      file_url: objectPath,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (verErr || !ver) {
    return NextResponse.json({ error: verErr?.message ?? "version failed" }, { status: 500 });
  }

  return NextResponse.json({ assetId: resolvedAssetId, versionId: ver.id });
}
