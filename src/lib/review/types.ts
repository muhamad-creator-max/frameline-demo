import type {
  AnnotationCoordinates,
  AnnotationType,
  CommentStatus,
  ReviewAssetKind,
  ReviewAssetStatus,
} from "@/lib/supabase/database.types";

export type {
  AnnotationCoordinates,
  AnnotationType,
  CommentStatus,
  ReviewAssetKind,
  ReviewAssetStatus,
};

/** A single annotation as the UI works with it (camelCase, percentage coords). */
export interface AnnotationDTO {
  id: string;
  commentId: string;
  timestampSeconds: number;
  type: AnnotationType;
  coordinates: AnnotationCoordinates;
  color: string;
  strokeWidth: number;
}

/** A comment or threaded reply, plus any attached annotations and its replies. */
export interface CommentDTO {
  id: string;
  parentId: string | null;
  /** Display name regardless of whether it's an owner or a guest. */
  authorName: string;
  /** True when authored by the project owner (vs a public guest). */
  isOwner: boolean;
  /** The guest's session token if this was authored by a guest (for own-edit checks). */
  guestToken: string | null;
  body: string;
  timestampSeconds: number | null;
  status: CommentStatus;
  createdAt: string;
  annotations: AnnotationDTO[];
  replies: CommentDTO[];
}

/** One uploaded version of an asset. */
export interface VersionDTO {
  id: string;
  version: number;
  status: ReviewAssetStatus;
  provider: "mux" | "bunny" | "storage";
  muxPlaybackId: string | null;
  fileUrl: string | null;
  durationS: number | null;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

/** An asset (media item) with its versions, for the review workspace. */
export interface AssetDTO {
  id: string;
  projectId: string;
  name: string;
  kind: ReviewAssetKind;
  currentVersion: number;
  versions: VersionDTO[];
}

/** Lightweight asset card for grids / folder listings. */
export interface AssetCardDTO {
  id: string;
  name: string;
  kind: ReviewAssetKind;
  folderId: string | null;
  currentVersion: number;
  status: ReviewAssetStatus;
  thumbnailUrl: string | null;
  durationS: number | null;
  commentCount: number;
  updatedAt: string;
}

export interface FolderDTO {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  /** Up to 4 thumbnail URLs from media inside this folder, for the folder card preview. */
  previewThumbs?: string[];
}

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  shareSlug: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
  viewCount: number;
}

/** A single drawn annotation carried with a new comment. */
export interface AnnotationDraftInput {
  type: AnnotationType;
  timestampSeconds: number;
  coordinates: AnnotationCoordinates;
  color: string;
  strokeWidth: number;
}

/** Payload sent when creating a comment (optionally carrying fresh annotations). */
export interface CreateCommentInput {
  versionId: string;
  body: string;
  /** null for a general comment; a number for a timestamped one. */
  timestampSeconds: number | null;
  /** Set when replying to an existing comment. */
  parentId?: string | null;
  /** All annotations drawn before submitting (one comment can hold several shapes). */
  annotations?: AnnotationDraftInput[] | null;
}

/** The Konva drawing tools exposed in the toolbar. (Text was removed — legacy
 *  text annotations still render in read mode, but none can be created.) */
export type DrawTool = "select" | "arrow" | "rect" | "ellipse" | "freehand";
