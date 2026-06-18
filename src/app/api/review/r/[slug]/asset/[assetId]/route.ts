import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSharedProject } from "@/lib/review/guest";
import { shapeAsset, signVersionUrls } from "@/lib/review/server";

export const runtime = "nodejs";

/**
 * GET /api/review/r/[slug]/asset/[assetId]
 * Public asset payload (versions + playable URLs) for a shared project.
 * Used by the guest flow to open an asset in the review workspace.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; assetId: string }> },
) {
  const { slug, assetId } = await params;

  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("review_assets")
    .select("id, project_id, name, kind, current_version, deleted_at")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.project_id !== project.id || asset.deleted_at) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: versions } = await admin
    .from("review_asset_versions")
    .select("*")
    .eq("asset_id", assetId)
    .order("version", { ascending: true });

  const dto = shapeAsset(asset, versions ?? []);
  await signVersionUrls(dto.versions);
  return NextResponse.json({ asset: dto });
}
