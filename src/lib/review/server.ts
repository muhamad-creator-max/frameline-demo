import "server-only";
import { muxHlsUrl, muxThumbnail } from "@/lib/mux/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { AnnotationDTO, AssetDTO, CommentDTO, VersionDTO } from "@/lib/review/types";

const REVIEW_BUCKET = "review-media";

/**
 * Resolve playable URLs for a set of versions. Mux versions use their HLS URL;
 * storage-backed (image/audio) versions get a short-lived signed URL since the
 * bucket is private. Mutates the passed DTOs' fileUrl in place for storage ones.
 */
export async function signVersionUrls(versions: VersionDTO[]): Promise<VersionDTO[]> {
  const storage = versions.filter((v) => v.provider === "storage" && v.fileUrl);
  if (storage.length === 0) return versions;
  const admin = createAdminClient();
  await Promise.all(
    storage.map(async (v) => {
      const { data } = await admin.storage
        .from(REVIEW_BUCKET)
        .createSignedUrl(v.fileUrl!, 60 * 60 * 6); // 6h
      if (data?.signedUrl) v.fileUrl = data.signedUrl;
      v.thumbnailUrl = v.thumbnailUrl ?? v.fileUrl;
    }),
  );
  return versions;
}

type CommentRow = Database["public"]["Tables"]["review_comments"]["Row"];
type AnnotationRow = Database["public"]["Tables"]["annotations"]["Row"];
type VersionRow = Database["public"]["Tables"]["review_asset_versions"]["Row"];

/** Map a DB annotation row → UI DTO. */
export function mapAnnotation(a: AnnotationRow): AnnotationDTO {
  return {
    id: a.id,
    commentId: a.comment_id,
    timestampSeconds: Number(a.timestamp_seconds),
    type: a.type,
    coordinates: (a.coordinates_json ?? {}) as AnnotationDTO["coordinates"],
    color: a.color,
    strokeWidth: Number(a.stroke_width),
  };
}

/**
 * Build a threaded comment tree (top-level comments with nested replies),
 * attaching annotations to each comment. Sorted by timestamp then creation.
 */
export function buildCommentTree(
  rows: CommentRow[],
  annotations: AnnotationRow[],
): CommentDTO[] {
  const annByComment = new Map<string, AnnotationDTO[]>();
  for (const a of annotations) {
    const list = annByComment.get(a.comment_id) ?? [];
    list.push(mapAnnotation(a));
    annByComment.set(a.comment_id, list);
  }

  const toDTO = (r: CommentRow): CommentDTO => ({
    id: r.id,
    parentId: r.parent_id,
    authorName: r.author_profile_id ? r.author_guest_name ?? "You" : r.author_guest_name ?? "Guest",
    isOwner: !!r.author_profile_id,
    guestToken: r.author_guest_token,
    body: r.body,
    timestampSeconds: r.timestamp_seconds == null ? null : Number(r.timestamp_seconds),
    status: r.status,
    createdAt: r.created_at,
    annotations: annByComment.get(r.id) ?? [],
    replies: [],
  });

  const byId = new Map<string, CommentDTO>();
  const roots: CommentDTO[] = [];
  for (const r of rows) byId.set(r.id, toDTO(r));
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const byTime = (a: CommentDTO, b: CommentDTO) =>
    (a.timestampSeconds ?? -1) - (b.timestampSeconds ?? -1) ||
    a.createdAt.localeCompare(b.createdAt);
  roots.sort(byTime);
  for (const r of roots) r.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return roots;
}

/** Map a version row → UI DTO. */
export function mapVersion(v: VersionRow): VersionDTO {
  return {
    id: v.id,
    version: v.version,
    status: v.status,
    provider: v.provider,
    muxPlaybackId: v.mux_playback_id,
    fileUrl: v.file_url,
    durationS: v.duration_s == null ? null : Number(v.duration_s),
    aspectRatio: v.aspect_ratio,
    width: v.width,
    height: v.height,
    thumbnailUrl: v.thumbnail_url,
  };
}

/** Resolve the playable source URL for a version (HLS for Mux, file for others). */
export function versionSrc(v: VersionDTO): string | null {
  if (v.provider === "mux" && v.muxPlaybackId) return muxHlsUrl(v.muxPlaybackId);
  return v.fileUrl;
}

/** Best-effort poster/thumbnail for a version. */
export function versionThumbnail(v: { mux_playback_id: string | null; thumbnail_url: string | null }): string | null {
  if (v.thumbnail_url) return v.thumbnail_url;
  if (v.mux_playback_id) return muxThumbnail(v.mux_playback_id, { width: 640 });
  return null;
}

/**
 * Insert a comment and (optionally) its attached annotation. Used by both the
 * owner route (authed Supabase) and the guest route (service role). The caller
 * passes an already-constructed comment row insert; we resolve the asset_id from
 * the version, write the comment, then the annotation if present.
 *
 * The authed server client and the admin client expose structurally identical
 * query APIs but the generated types treat them as distinct, so callers pass
 * their client as `unknown` and we narrow to this structural shape internally.
 * Callers are trusted server code.
 */
type QueryClient = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: { asset_id?: string } | null }> };
    };
    insert: (v: unknown) => {
      select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
    } & Promise<{ error: { message: string } | null }>;
  };
};

export interface CommentInsert {
  version_id: string;
  parent_id?: string | null;
  author_profile_id?: string | null;
  author_guest_name?: string | null;
  author_guest_token?: string | null;
  body: string;
  timestamp_seconds?: number | null;
}

export interface AnnotationInsertInput {
  type: Database["public"]["Enums"]["annotation_type"];
  timestampSeconds: number;
  coordinates: import("@/lib/supabase/database.types").AnnotationCoordinates;
  color: string;
  strokeWidth: number;
}

export async function insertCommentWithAnnotation(
  rawClient: unknown,
  comment: CommentInsert,
  /** One annotation, several, or none. A comment can carry multiple shapes. */
  annotations: AnnotationInsertInput | AnnotationInsertInput[] | null,
): Promise<{ id: string } | { error: string }> {
  const client = rawClient as QueryClient;
  // Resolve asset_id from the version.
  const { data: ver } = await client
    .from("review_asset_versions")
    .select("asset_id")
    .eq("id", comment.version_id)
    .maybeSingle();
  if (!ver?.asset_id) return { error: "version not found" };

  const { data: row, error } = await client
    .from("review_comments")
    .insert({ ...comment, asset_id: ver.asset_id })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[review] comment insert failed:", error);
    return { error: error?.message ?? "comment failed" };
  }

  const list = annotations == null ? [] : Array.isArray(annotations) ? annotations : [annotations];
  if (list.length > 0) {
    // Guard against a non-finite timestamp (which would serialize to null and
    // violate the NOT NULL constraint): fall back to the comment's timestamp, then 0.
    const rows = list.map((a) => ({
      comment_id: row.id,
      version_id: comment.version_id,
      asset_id: ver.asset_id,
      timestamp_seconds: Number.isFinite(a.timestampSeconds)
        ? a.timestampSeconds
        : Number.isFinite(comment.timestamp_seconds ?? NaN)
          ? (comment.timestamp_seconds as number)
          : 0,
      type: a.type,
      coordinates_json: a.coordinates,
      color: a.color,
      stroke_width: a.strokeWidth,
    }));
    // Single batched insert for all shapes.
    const { error: annErr } = await client.from("annotations").insert(rows);
    if (annErr) {
      console.error("[review] annotation insert failed:", annErr);
      return { error: annErr.message };
    }
  }

  return { id: row.id };
}

export function shapeAsset(
  asset: { id: string; project_id: string; name: string; kind: AssetDTO["kind"]; current_version: number },
  versions: VersionRow[],
): AssetDTO {
  return {
    id: asset.id,
    projectId: asset.project_id,
    name: asset.name,
    kind: asset.kind,
    currentVersion: asset.current_version,
    versions: versions.map(mapVersion).sort((a, b) => a.version - b.version),
  };
}

export interface SharedProjectPayload {
  folders: { id: string; parentId: string | null; name: string; position: number }[];
  assets: {
    id: string;
    name: string;
    kind: AssetDTO["kind"];
    folderId: string | null;
    currentVersion: number;
    status: VersionRow["status"];
    thumbnailUrl: string | null;
    durationS: number | null;
  }[];
}

/**
 * Build the folders + assets listing a guest sees for a shared project.
 * Only assets whose CURRENT version is ready are surfaced. Storage thumbnails
 * are signed. Uses the service-role client (public, no RLS context).
 */
export async function buildSharedProjectPayload(projectId: string): Promise<SharedProjectPayload> {
  const admin = createAdminClient();

  const [{ data: folders }, { data: assets }] = await Promise.all([
    admin
      .from("review_folders")
      .select("id, parent_id, name, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    admin
      .from("review_assets")
      .select("id, name, kind, folder_id, current_version")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("position", { ascending: true }),
  ]);

  const assetIds = (assets ?? []).map((a) => a.id);
  const versionsByAsset = new Map<string, VersionRow>();
  if (assetIds.length) {
    const { data: vers } = await admin
      .from("review_asset_versions")
      .select("*")
      .in("asset_id", assetIds);
    for (const v of vers ?? []) {
      const a = (assets ?? []).find((x) => x.id === v.asset_id);
      if (a && v.version === a.current_version) versionsByAsset.set(v.asset_id, v as VersionRow);
    }
  }

  const shaped = await Promise.all(
    (assets ?? []).map(async (a) => {
      const v = versionsByAsset.get(a.id);
      let thumb = v ? versionThumbnail({ mux_playback_id: v.mux_playback_id, thumbnail_url: v.thumbnail_url }) : null;
      if (v?.provider === "storage" && v.file_url && !thumb) {
        const { data } = await admin.storage.from(REVIEW_BUCKET).createSignedUrl(v.file_url, 60 * 60 * 6);
        thumb = data?.signedUrl ?? null;
      }
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        folderId: a.folder_id,
        currentVersion: a.current_version,
        status: (v?.status ?? "processing") as VersionRow["status"],
        thumbnailUrl: thumb,
        durationS: v?.duration_s == null ? null : Number(v.duration_s),
      };
    }),
  );

  return {
    folders: (folders ?? []).map((f) => ({
      id: f.id,
      parentId: f.parent_id,
      name: f.name,
      position: f.position,
    })),
    assets: shaped,
  };
}
