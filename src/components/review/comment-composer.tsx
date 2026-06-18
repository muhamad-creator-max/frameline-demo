"use client";

import * as React from "react";
import { Clock, Pencil, Send, X, Loader2 } from "lucide-react";
import { useReviewStore } from "@/lib/review/store";
import { formatTimecodeFrames } from "@/lib/review/coords";
import type { CreateCommentInput } from "@/lib/review/types";

/**
 * Comment input. Reused for new comments (with optional captured timestamp +
 * attached annotation draft) and for replies (compact, no timestamp/annotation).
 */
export function CommentComposer({
  versionId,
  parentId,
  compact,
  autoFocus,
  placeholder,
  onSubmit,
  onCancel,
  canAnnotate,
}: {
  versionId: string;
  parentId?: string | null;
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onSubmit: (input: CreateCommentInput) => Promise<void>;
  onCancel?: () => void;
  /** Show the Annotate toggle (video only, top-level composer). */
  canAnnotate?: boolean;
}) {
  const currentTime = useReviewStore((s) => s.currentTime);
  const drafts = useReviewStore((s) => s.drafts);
  const setDrafts = useReviewStore((s) => s.setDrafts);
  const annotating = useReviewStore((s) => s.annotating);
  const setAnnotating = useReviewStore((s) => s.setAnnotating);

  const [body, setBody] = React.useState("");
  // For top-level comments, capture the timestamp at the moment of typing/paused.
  const [attachTime, setAttachTime] = React.useState(!compact);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // When a fresh annotation draft appears, focus the composer so the user can
  // type their comment immediately (requirement: open comment input automatically).
  React.useEffect(() => {
    if (drafts.length > 0 && !compact) ref.current?.focus();
  }, [drafts.length, compact]);

  const hasAnnotation = !compact && drafts.length > 0;

  async function submit() {
    const text = body.trim();
    if (!text && !hasAnnotation) return;
    setBusy(true);
    try {
      const ts = hasAnnotation
        ? drafts[0].timestampSeconds
        : attachTime
          ? currentTime
          : null;
      await onSubmit({
        versionId,
        parentId: parentId ?? null,
        body: text,
        timestampSeconds: ts,
        // Attach ALL drawn shapes, not just the last one.
        annotations: hasAnnotation
          ? drafts.map((d) => ({
              type: d.type,
              timestampSeconds: d.timestampSeconds,
              coordinates: d.coordinates,
              color: d.color,
              strokeWidth: d.strokeWidth,
            }))
          : null,
      });
      setBody("");
      setDrafts([]);
      if (annotating) setAnnotating(false);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
    if (e.key === "Escape" && onCancel) onCancel();
  }

  return (
    <div
      style={{
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* attachment chips */}
      {(hasAnnotation || (!compact && attachTime)) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {!compact && (
            <button
              type="button"
              onClick={() => setAttachTime((v) => !v)}
              title="Attach the current timestamp"
              style={chipStyle(attachTime)}
            >
              <Clock size={12} />
              {attachTime ? formatTimecodeFrames(currentTime) : "No timestamp"}
            </button>
          )}
          {hasAnnotation && (
            <span style={{ ...chipStyle(true), cursor: "default" }}>
              <Pencil size={12} />
              {drafts.length === 1 ? `${drafts[0].type} annotation` : `${drafts.length} annotations`}
              <X
                size={12}
                style={{ cursor: "pointer", marginInlineStart: 2 }}
                onClick={() => setDrafts([])}
              />
            </span>
          )}
        </div>
      )}

      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? (compact ? "Reply…" : "Leave a comment…")}
        rows={compact ? 1 : 2}
        style={{
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text)",
          fontSize: 13.5,
          lineHeight: 1.5,
          fontFamily: "inherit",
          width: "100%",
          minHeight: compact ? 24 : 40,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {!compact && canAnnotate && (
            <button
              type="button"
              onClick={() => setAnnotating(!annotating)}
              title={annotating ? "Stop annotating" : "Draw on the current frame"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-raw)",
                background: annotating || hasAnnotation ? "var(--accent-weak)" : "transparent",
                color: annotating || hasAnnotation ? "var(--accent-ink)" : "var(--text-2)",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Pencil size={13} /> {annotating ? "Drawing…" : hasAnnotation ? "Annotated" : "Annotate"}
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} style={ghostBtn}>
              Cancel
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!body.trim() && !hasAnnotation)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 6,
            border: "none",
            background: busy || (!body.trim() && !hasAnnotation) ? "var(--surface-2)" : "var(--accent)",
            color: busy || (!body.trim() && !hasAnnotation) ? "var(--text-3)" : "var(--accent-contrast)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: busy || (!body.trim() && !hasAnnotation) ? "default" : "pointer",
          }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {compact ? "Reply" : "Comment"}
        </button>
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11.5,
    fontWeight: 500,
    border: "1px solid var(--border-raw)",
    background: active ? "var(--accent-weak)" : "var(--surface-2)",
    color: active ? "var(--accent-ink)" : "var(--text-2)",
    cursor: "pointer",
  };
}

const ghostBtn: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 12.5,
  cursor: "pointer",
};
