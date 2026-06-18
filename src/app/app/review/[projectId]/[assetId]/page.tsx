import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { shapeAsset, signVersionUrls } from "@/lib/review/server";
import type { ProjectDTO } from "@/lib/review/types";
import { OwnerReviewClient } from "@/components/review/owner-review-client";

export const metadata = { title: "Review" };

export default async function ReviewAssetPage({
  params,
}: {
  params: Promise<{ projectId: string; assetId: string }>;
}) {
  const { projectId, assetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Project (ownership) + asset + versions.
  const { data: project } = await supabase
    .from("review_projects")
    .select("id, name, description, share_slug, password_hash, allow_download, view_count")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) notFound();

  const { data: asset } = await supabase
    .from("review_assets")
    .select("id, project_id, name, kind, current_version")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!asset) notFound();

  const { data: versions } = await supabase
    .from("review_asset_versions")
    .select("*")
    .eq("asset_id", assetId)
    .order("version", { ascending: true });

  const assetDTO = shapeAsset(asset, versions ?? []);
  await signVersionUrls(assetDTO.versions); // resolve signed URLs for storage media

  const projectDTO: ProjectDTO = {
    id: project.id,
    name: project.name,
    description: project.description,
    shareSlug: project.share_slug,
    hasPassword: !!project.password_hash,
    allowDownload: project.allow_download,
    viewCount: project.view_count,
  };

  return (
    <OwnerReviewClient asset={assetDTO} project={projectDTO} />
  );
}
