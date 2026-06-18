"use client";

import * as React from "react";
import { MessageSquare, Pencil, CornerDownRight, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReviewStore } from "@/lib/review/store";
import { formatTimecodeFrames } from "@/lib/review/coords";
import type { CommentDTO, CreateCommentInput } from "@/lib/review/types";
import type { CommentStatus } from "@/lib/supabase/database.types";
import { CommentComposer } from "./comment-composer";
import { StatusPill } from "./status-pill";

export interface CommentsPanelCallbacks {
  onCreate: (input: CreateCommentInput) => Promise<void>;
  onReply: (input: CreateCommentInput) => Promise<void>;
  onSetStatus?: (commentId: string, status: CommentStatus) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  /** Edit a comment's body. Present only when the viewer may edit own comments. */
  onEdit?: (commentId: string, body: string) => Promise<void>;
  /** Whether the current viewer may change status (owner) — guests can't. */
  canManageStatus: boolean;
  /** The current guest's token, when in guest mode (to allow own delete). */
  guestToken?: string | null;
}

export function CommentsPanel({
  versionId,
  onSeek,
  callbacks,
  versionPicker,
  canAnnotate,
}: {
  versionId: string;
  onSeek: (t: number) => void;
  callbacks: CommentsPanelCallbacks;
  /** Optional control (e.g. compare mode) to pick which version's comments to show. */
  versionPicker?: React.ReactNode;
  /** Whether the Annotate toggle should appear in the composer (video, not comparing). */
  canAnnotate?: boolean;
}) {
  const comments = useReviewStore((s) => s.comments);
  const activeCommentId = useReviewStore((s) => s.activeCommentId);
  const setActiveCommentId = useReviewStore((s) => s.setActiveCommentId);

  const total = React.useMemo(() => countComments(comments), [comments]);

  return (
    <div
      style={{
        width: 384,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderInlineStart: "1px solid var(--border-raw)",
        background: "var(--bg-2)",
        height: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-raw)",
        }}
      >
        <MessageSquare size={16} style={{ color: "var(--text-2)" }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Comments</span>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{total}</span>
        {versionPicker && (
          <>
            <div style={{ flex: 1 }} />
            {versionPicker}
          </>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: "32px 12px" }}>
            No comments yet. Pause the video and leave the first one.
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              active={activeCommentId === c.id}
              versionId={versionId}
              onSeek={onSeek}
              onActivate={setActiveCommentId}
              callbacks={callbacks}
            />
          ))
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border-raw)", padding: 12 }}>
        <CommentComposer versionId={versionId} onSubmit={callbacks.onCreate} canAnnotate={canAnnotate} />
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  active,
  versionId,
  onSeek,
  onActivate,
  callbacks,
}: {
  comment: CommentDTO;
  active: boolean;
  versionId: string;
  onSeek: (t: number) => void;
  onActivate: (id: string | null) => void;
  callbacks: CommentsPanelCallbacks;
}) {
  const [replying, setReplying] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(comment.body);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const hasAnnotation = comment.annotations.length > 0;

  // Own-comment actions are allowed for the owner OR the guest who authored it.
  const isMine =
    callbacks.canManageStatus || (!!comment.guestToken && comment.guestToken === callbacks.guestToken);
  const canDelete = !!callbacks.onDelete && isMine;
  const canEdit = !!callbacks.onEdit && isMine;

  async function saveEdit() {
    const next = editBody.trim();
    if (!next || next === comment.body) {
      setEditing(false);
      setEditBody(comment.body);
      return;
    }
    setSavingEdit(true);
    try {
      await callbacks.onEdit?.(comment.id, next);
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  function activate() {
    onActivate(comment.id);
    if (comment.timestampSeconds != null) onSeek(comment.timestampSeconds);
  }

  return (
    <div
      onClick={activate}
      style={{
        borderRadius: "var(--r-sm)",
        border: active ? "1px solid var(--accent)" : "1px solid transparent",
        background: active ? "var(--accent-weak)" : "var(--surface)",
        boxShadow: active ? "none" : "var(--shadow-sm)",
        padding: 10,
        cursor: "pointer",
        transition: "background .1s ease, border-color .1s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar name={comment.authorName} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{comment.authorName}</span>
        {comment.timestampSeconds != null && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              activate();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 7px",
              borderRadius: 11,
              border: "none",
              background: "var(--surface-2)",
              color: "var(--accent-ink)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-jetbrains-mono, monospace)",
            }}
          >
            {formatTimecodeFrames(comment.timestampSeconds)}
          </button>
        )}
        {hasAnnotation && (
          <Pencil size={12} style={{ color: "var(--accent-ink)" }} aria-label="Has annotation" />
        )}
        <div style={{ flex: 1 }} />
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                style={{ border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer", padding: 2 }}
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditBody(comment.body);
                    setEditing(true);
                  }}
                  className="text-[13px]"
                >
                  <Pencil size={13} className="mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => callbacks.onDelete?.(comment.id)}
                  className="text-[13px] text-destructive focus:text-destructive"
                >
                  <Trash2 size={13} className="mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {editing ? (
        <div style={{ marginTop: 7 }} onClick={(e) => e.stopPropagation()}>
          <textarea
            value={editBody}
            autoFocus
            onChange={(e) => setEditBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void saveEdit();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setEditBody(comment.body);
              }
            }}
            rows={2}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-2)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13.5,
              lineHeight: 1.5,
              padding: "6px 8px",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditBody(comment.body);
              }}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 12.5, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit || !editBody.trim()}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "none",
                background: savingEdit || !editBody.trim() ? "var(--surface-2)" : "var(--accent)",
                color: savingEdit || !editBody.trim() ? "var(--text-3)" : "var(--accent-contrast)",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: savingEdit || !editBody.trim() ? "default" : "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        comment.body && (
          <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>
            {comment.body}
          </p>
        )
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <StatusPill
          status={comment.status}
          readOnly={!callbacks.canManageStatus}
          onChange={
            callbacks.canManageStatus && callbacks.onSetStatus
              ? (next) => callbacks.onSetStatus!(comment.id, next)
              : undefined
          }
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setReplying((v) => !v);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: "none",
            background: "transparent",
            color: "var(--text-2)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <CornerDownRight size={12} /> Reply
        </button>
      </div>

      {/* replies */}
      {comment.replies.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingInlineStart: 10,
            borderInlineStart: "2px solid var(--border-raw)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {comment.replies.map((r) => (
            <div key={r.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Avatar name={r.authorName} small />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{r.authorName}</span>
              </div>
              {r.body && (
                <p style={{ margin: "4px 0 0 24px", fontSize: 13, lineHeight: 1.45, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>
                  {r.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {replying && (
        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <CommentComposer
            versionId={versionId}
            parentId={comment.id}
            compact
            autoFocus
            onSubmit={async (input) => {
              await callbacks.onReply(input);
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  const size = small ? 18 : 22;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "var(--accent-contrast)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: small ? 9 : 11,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {(name[0] ?? "?").toUpperCase()}
    </span>
  );
}

function countComments(comments: CommentDTO[]): number {
  return comments.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}
