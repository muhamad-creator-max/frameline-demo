"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Share2, Columns2, MessageSquare, X } from "lucide-react";
import { useReviewStore } from "@/lib/review/store";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { versionSrcClient } from "@/lib/review/client";
import type { AssetDTO, CommentDTO, CreateCommentInput } from "@/lib/review/types";
import type { AnnotationCoordinates, CommentStatus } from "@/lib/supabase/database.types";
import { VideoStage, type VideoStageHandle } from "./video-stage";
import { CommentsPanel } from "./comments-panel";
import { VersionSwitcher } from "./version-switcher";

/**
 * Data operations the workspace needs. Owner and guest pages provide different
 * concrete implementations (authed Supabase API vs public share API), but the
 * UI is identical.
 */
export interface ReviewApi {
  /** Fetch comments (+ annotations) for a version. */
  loadComments: (versionId: string) => Promise<{ comments: CommentDTO[]; guestToken?: string | null }>;
  createComment: (input: CreateCommentInput) => Promise<void>;
  setStatus?: (commentId: string, status: CommentStatus) => Promise<void>;
  deleteComment?: (commentId: string) => Promise<void>;
  /** Edit a comment's body (own comments only, enforced server-side). */
  editComment?: (commentId: string, body: string) => Promise<void>;
  editAnnotation?: (annotationId: string, coordinates: AnnotationCoordinates) => Promise<void>;
}

export function ReviewWorkspace({
  asset,
  mode,
  api,
  shareSlug,
  allowDownload,
  onShare,
}: {
  asset: AssetDTO;
  mode: "owner" | "guest";
  api: ReviewApi;
  shareSlug?: string | null;
  allowDownload?: boolean;
  onShare?: () => void;
}) {
  const readyVersions = React.useMemo(
    () => asset.versions.filter((v) => v.status === "ready"),
    [asset.versions],
  );
  const initialVersion =
    readyVersions.find((v) => v.version === asset.currentVersion) ??
    readyVersions[readyVersions.length - 1] ??
    asset.versions[asset.versions.length - 1];

  const [versionId, setVersionId] = React.useState<string>(initialVersion?.id ?? "");
  const version = asset.versions.find((v) => v.id === versionId) ?? initialVersion;

  const setComments = useReviewStore((s) => s.setComments);
  const comments = useReviewStore((s) => s.comments);
  const addComment = useReviewStore((s) => s.addComment);
  const setStoreStatus = useReviewStore((s) => s.setCommentStatus);
  const removeComment = useReviewStore((s) => s.removeComment);
  const updateComment = useReviewStore((s) => s.updateComment);
  const setStoreVersion = useReviewStore((s) => s.setVersionId);
  const resetDrawing = useReviewStore((s) => s.resetDrawing);

  const [guestToken, setGuestToken] = React.useState<string | null>(null);
  const stageRef = React.useRef<VideoStageHandle>(null);

  // On phones the comments panel can't sit beside the video — stack the video
  // full-width and open comments as a slide-up sheet via a toggle.
  const isMobile = useIsMobile();
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const totalComments = React.useMemo(() => countAllComments(comments), [comments]);

  // ── compare mode ──
  // The PRIMARY player is always the active `version` (also the comments source).
  // Compare adds a slaved mirror of `compareVersionId` inside the SAME stage.
  const readyForCompare = React.useMemo(
    () => asset.versions.filter((v) => v.status === "ready" && (v.muxPlaybackId || v.fileUrl)),
    [asset.versions],
  );
  const canCompare = asset.kind === "video" && readyForCompare.length >= 2;
  const [comparing, setComparing] = React.useState(false);
  const [compareVersionId, setCompareVersionId] = React.useState<string | null>(null);

  // Load comments whenever the active version CHANGES (by id, not object identity
  // — depending on the object would refire on unrelated re-renders and race).
  const versionLoadId = version?.id ?? null;
  React.useEffect(() => {
    if (!versionLoadId) return;
    let cancelled = false;
    setStoreVersion(versionLoadId);
    resetDrawing();
    setComments([]);
    api
      .loadComments(versionLoadId)
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setGuestToken(res.guestToken ?? null);
      })
      .catch((e) => {
        if (cancelled) return; // a faster version switch superseded this load
        console.error("[review] loadComments failed:", e);
        toast.error("Failed to load comments");
      });
    return () => {
      cancelled = true;
    };
  }, [versionLoadId, api, setComments, setStoreVersion, resetDrawing]);

  // Flatten annotations of the active version for the canvas.
  const annotations = React.useMemo(() => flattenAnnotations(comments), [comments]);

  // The compare (mirror) version — defaults to a different ready version than
  // the primary; kept valid as the primary changes.
  const compareVersion = React.useMemo(() => {
    if (!comparing) return null;
    const id = compareVersionId;
    const chosen = readyForCompare.find((v) => v.id === id && v.id !== version?.id);
    if (chosen) return chosen;
    // fall back to any ready version that isn't the primary
    return readyForCompare.find((v) => v.id !== version?.id) ?? null;
  }, [comparing, compareVersionId, readyForCompare, version?.id]);

  if (!version) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-3)" }}>
        This media is still processing…
      </div>
    );
  }

  const src = versionSrcClient(version);

  async function handleCreate(input: CreateCommentInput) {
    try {
      await api.createComment(input);
      // Reload to pick up server-generated ids + annotation rows.
      const res = await api.loadComments(input.versionId);
      setComments(res.comments);
      toast.success(input.parentId ? "Reply posted" : "Comment posted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
      throw e;
    }
  }

  async function handleSetStatus(commentId: string, status: CommentStatus) {
    if (!api.setStatus) return;
    setStoreStatus(commentId, status); // optimistic
    try {
      await api.setStatus(commentId, status);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(commentId: string) {
    if (!api.deleteComment) return;
    const snapshot = comments;
    removeComment(commentId); // optimistic
    try {
      await api.deleteComment(commentId);
    } catch {
      setComments(snapshot);
      toast.error("Failed to delete");
    }
  }

  async function handleEdit(commentId: string, body: string) {
    if (!api.editComment) return;
    const snapshot = comments;
    updateComment(commentId, { body }); // optimistic
    try {
      await api.editComment(commentId, body);
    } catch {
      setComments(snapshot);
      toast.error("Failed to save edit");
    }
  }

  async function handleEditAnnotation(id: string, coordinates: AnnotationCoordinates) {
    if (!api.editAnnotation) return;
    try {
      await api.editAnnotation(id, coordinates);
    } catch {
      toast.error("Failed to save annotation change");
    }
  }

  function toggleCompare() {
    if (comparing) {
      setComparing(false);
      return;
    }
    // Default to the two latest ready versions, with the LONGER one as the
    // primary (master clock) so the shorter mirror freezes at its end while the
    // longer one keeps playing. Comments default to the primary; user can switch.
    const candidates = [...readyForCompare].sort((a, b) => b.version - a.version).slice(0, 2);
    if (candidates.length < 2) return;
    const [a, b] = candidates;
    const longer = (a.durationS ?? 0) >= (b.durationS ?? 0) ? a : b;
    const shorter = longer.id === a.id ? b : a;
    setVersionId(longer.id);
    setCompareVersionId(shorter.id);
    setComparing(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          padding: isMobile ? "10px 12px" : "12px 16px",
          borderBottom: "1px solid var(--border-raw)",
          background: "var(--bg)",
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </h1>
        <div style={{ flex: 1 }} />
        {canCompare && (
          <button
            type="button"
            onClick={toggleCompare}
            style={{
              ...iconBtn,
              width: "auto",
              gap: 6,
              padding: "0 11px",
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12.5,
              fontWeight: 500,
              background: comparing ? "var(--accent-weak)" : "var(--surface)",
              color: comparing ? "var(--accent-ink)" : "var(--text-2)",
            }}
            title="Compare versions"
          >
            <Columns2 size={15} /> {!isMobile && "Compare"}
          </button>
        )}
        <VersionSwitcher versions={asset.versions} activeId={version.id} onSelect={setVersionId} />
        {allowDownload && shareSlug && !comparing && (
          <a
            href={`/api/review/r/${shareSlug}/download/${version.id}`}
            style={iconBtnLink}
            title="Download"
          >
            <Download size={15} />
          </a>
        )}
        {mode === "owner" && onShare && (
          <button type="button" onClick={onShare} style={iconBtn} title="Share">
            <Share2 size={15} />
          </button>
        )}
      </header>

      {/* body: the SAME stage (with an optional compare mirror) + comments.
          Desktop = side-by-side row; mobile = video full-width with comments in
          a slide-up sheet (toggled by the floating button below). */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 12 : 16, overflowY: "auto" }}>
          <VideoStage
            ref={stageRef}
            kind={asset.kind}
            version={version}
            src={src}
            annotations={annotations}
            onSubmitAnnotation={() => {}}
            onEditAnnotation={mode === "owner" ? handleEditAnnotation : undefined}
            compareVersion={comparing ? compareVersion : null}
            compareSrc={comparing && compareVersion ? versionSrcClient(compareVersion) : null}
            compareAnnotations={[]}
            compareHeader={
              comparing && compareVersion ? (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>Comparing</span>
                  <span style={pillStyle}>Primary V{version.version}</span>
                  <span style={{ color: "var(--text-3)" }}>vs</span>
                  <VersionSwitcher
                    versions={readyForCompare.filter((v) => v.id !== version.id)}
                    activeId={compareVersion.id}
                    onSelect={setCompareVersionId}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    (audio &amp; controls follow the primary)
                  </span>
                </>
              ) : null
            }
          />
        </div>

        {/* Mobile: dim backdrop behind the sheet. */}
        {isMobile && commentsOpen && (
          <div
            onClick={() => setCommentsOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 40 }}
          />
        )}

        {/* Comments: inline side panel on desktop, slide-up sheet on mobile. */}
        <div
          style={
            isMobile
              ? {
                  position: "fixed",
                  insetInline: 0,
                  insetBlockEnd: 0,
                  height: "min(72vh, 560px)",
                  zIndex: 41,
                  borderStartStartRadius: "var(--r-lg)",
                  borderStartEndRadius: "var(--r-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-lg)",
                  transform: commentsOpen ? "translateY(0)" : "translateY(110%)",
                  transition: "transform .25s cubic-bezier(.22,.61,.36,1)",
                  display: "flex",
                  flexDirection: "column",
                }
              : undefined
          }
        >
          {isMobile && (
            <button
              type="button"
              onClick={() => setCommentsOpen(false)}
              style={{
                position: "absolute",
                insetBlockStart: 10,
                insetInlineEnd: 10,
                zIndex: 1,
                ...iconBtn,
                width: 30,
                height: 30,
              }}
              aria-label="Close comments"
            >
              <X size={15} />
            </button>
          )}
          <CommentsPanel
            versionId={version.id}
            canAnnotate={asset.kind === "video" && !comparing}
            fullHeight={isMobile}
            versionPicker={
              comparing ? (
                <VersionSwitcher versions={asset.versions} activeId={version.id} onSelect={setVersionId} />
              ) : undefined
            }
            onSeek={(t) => {
              // Pause so the viewer lands on the exact frame — required for the
              // comment's (single-frame) annotation to actually be visible.
              stageRef.current?.pause();
              stageRef.current?.seekTo(t);
              if (isMobile) setCommentsOpen(false); // reveal the frame on phones
            }}
            callbacks={{
              onCreate: handleCreate,
              onReply: handleCreate,
              onSetStatus: api.setStatus ? handleSetStatus : undefined,
              onDelete: api.deleteComment ? handleDelete : undefined,
              onEdit: api.editComment ? handleEdit : undefined,
              canManageStatus: mode === "owner",
              guestToken,
            }}
          />
        </div>
      </div>

      {/* Mobile: floating button to open the comments sheet. */}
      {isMobile && !commentsOpen && (
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          style={{
            position: "fixed",
            insetBlockEnd: 18,
            insetInlineEnd: 18,
            zIndex: 39,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 46,
            padding: "0 18px",
            borderRadius: 999,
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "var(--shadow-lg)",
            cursor: "pointer",
          }}
        >
          <MessageSquare size={17} />
          Comments
          {totalComments > 0 && <span style={{ opacity: 0.85 }}>{totalComments}</span>}
        </button>
      )}
    </div>
  );
}

function countAllComments(comments: CommentDTO[]): number {
  return comments.reduce((n, c) => n + 1 + countAllComments(c.replies), 0);
}

function flattenAnnotations(comments: CommentDTO[]): CommentDTO["annotations"] {
  const out: CommentDTO["annotations"] = [];
  const walk = (list: CommentDTO[]) => {
    for (const c of list) {
      out.push(...c.annotations);
      if (c.replies.length) walk(c.replies);
    }
  };
  walk(comments);
  return out;
}

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  border: "1px solid var(--border-raw)",
  background: "var(--surface)",
  color: "var(--text-2)",
  cursor: "pointer",
};

const iconBtnLink: React.CSSProperties = { ...iconBtn, textDecoration: "none" };

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 9px",
  borderRadius: 7,
  border: "1px solid var(--border-raw)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12.5,
  fontWeight: 500,
};
