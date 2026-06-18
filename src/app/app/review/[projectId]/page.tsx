import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { versionThumbnail } from "@/lib/review/server";
import type { AssetCardDTO, FolderDTO, ProjectDTO } from "@/lib/review/types";
import { ProjectWorkspace } from "@/components/review/project-workspace";

export const metadata = { title: "Review project" };

export default async function ReviewProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("review_projects")
    .select("id, name, description, share_slug, password_hash, allow_download, view_count")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: folders }, { data: assets }] = await Promise.all([
    supabase
      .from("review_folders")
      .select("id, parent_id, name, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase
      .from("review_assets")
      .select("id, name, kind, folder_id, current_version, updated_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  // Fetch the current version of each asset for status/thumb/duration, plus comment counts.
  const assetIds = (assets ?? []).map((a) => a.id);
  const versionByAsset = new Map<string, { status: AssetCardDTO["status"]; thumb: string | null; dur: number | null }>();
  const commentCountByAsset = new Map<string, number>();

  if (assetIds.length) {
    const [{ data: versions }, { data: comments }] = await Promise.all([
      supabase
        .from("review_asset_versions")
        .select("asset_id, version, status, mux_playback_id, thumbnail_url, duration_s")
        .in("asset_id", assetIds),
      supabase.from("review_comments").select("asset_id").in("asset_id", assetIds),
    ]);
    for (const a of assets ?? []) {
      const v = (versions ?? []).find((x) => x.asset_id === a.id && x.version === a.current_version);
      versionByAsset.set(a.id, {
        status: (v?.status ?? "processing") as AssetCardDTO["status"],
        thumb: v ? versionThumbnail({ mux_playback_id: v.mux_playback_id, thumbnail_url: v.thumbnail_url }) : null,
        dur: v?.duration_s == null ? null : Number(v.duration_s),
      });
    }
    for (const c of comments ?? []) {
      commentCountByAsset.set(c.asset_id, (commentCountByAsset.get(c.asset_id) ?? 0) + 1);
    }
  }

  const projectDTO: ProjectDTO = {
    id: project.id,
    name: project.name,
    description: project.description,
    shareSlug: project.share_slug,
    hasPassword: !!project.password_hash,
    allowDownload: project.allow_download,
    viewCount: project.view_count,
  };

  const assetDTOs: AssetCardDTO[] = (assets ?? []).map((a) => {
    const v = versionByAsset.get(a.id);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      folderId: a.folder_id,
      currentVersion: a.current_version,
      status: v?.status ?? "processing",
      thumbnailUrl: v?.thumb ?? null,
      durationS: v?.dur ?? null,
      commentCount: commentCountByAsset.get(a.id) ?? 0,
      updatedAt: a.updated_at,
    };
  });

  // Per-folder preview thumbnails: up to 4 thumbnails from media anywhere in the
  // folder's subtree (so a folder shows a peek of its contents before opening).
  const childFolderIds = new Map<string | null, string[]>();
  for (const f of folders ?? []) {
    const list = childFolderIds.get(f.parent_id) ?? [];
    list.push(f.id);
    childFolderIds.set(f.parent_id, list);
  }
  const thumbsByFolder = new Map<string, string[]>();
  function collectThumbs(folderId: string): string[] {
    const direct = assetDTOs.filter((a) => a.folderId === folderId && a.thumbnailUrl).map((a) => a.thumbnailUrl!);
    const fromChildren = (childFolderIds.get(folderId) ?? []).flatMap((cid) => collectThumbs(cid));
    const all = [...direct, ...fromChildren].slice(0, 4);
    thumbsByFolder.set(folderId, all);
    return all;
  }
  for (const f of folders ?? []) if (!thumbsByFolder.has(f.id)) collectThumbs(f.id);

  const folderDTOs: FolderDTO[] = (folders ?? []).map((f) => ({
    id: f.id,
    parentId: f.parent_id,
    name: f.name,
    position: f.position,
    previewThumbs: thumbsByFolder.get(f.id) ?? [],
  }));

  return <ProjectWorkspace project={projectDTO} folders={folderDTOs} assets={assetDTOs} />;
}
