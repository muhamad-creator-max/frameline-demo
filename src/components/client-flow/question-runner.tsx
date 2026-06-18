"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, ThumbsUp, ThumbsDown, Loader2, X as XIcon, Type as TypeIcon, Maximize2, Play, Pause, Layers, Sparkles, Paperclip, Download, Copy } from "lucide-react";
import type { GuidelineSnapshotPayload, Attachment, SettingCell } from "@/lib/supabase/database.types";
import { CommentComposer } from "./comment-composer";
import { useI18n } from "@/lib/i18n/provider";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });

type Snapshot = GuidelineSnapshotPayload;
type Question = Snapshot["questions"][number];
type Option = Question["options"][number];

interface AnswerDraft {
  selectedOptionIds?: string[];
  liked?: boolean | null;
  textValue?: string;
  commentText?: string;
  commentAttachments?: Attachment[];
}

const VIEWPORT_MARGIN = 50;

export function QuestionRunner({
  slug,
  guidelineId,
  snapshot,
  responseId,
  readyToGo = false,
  clientName,
  onDone,
}: {
  slug: string;
  guidelineId: string;
  snapshot: Snapshot;
  responseId: string | null;
  readyToGo?: boolean;
  clientName: string;
  onDone: () => void;
}) {
  const { dir } = useI18n();
  const isRtl = dir === "rtl";

  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, AnswerDraft>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [lightboxOption, setLightboxOption] = React.useState<Option | null>(null);

  // Active sequence given conditional reveal rules. A question that's listed
  // in some option's reveal_question_ids is hidden until the client picks that
  // option; everything else is visible by default.
  const visibleQuestions = React.useMemo(() => {
    const all = snapshot.questions;
    // Ready-to-go is a read-only reference — no selection, so no conditional
    // reveal. Every question is always shown.
    if (readyToGo) return all;
    const revealed = new Set<string>();
    for (const qid in answers) {
      const drft = answers[qid];
      const question = all.find((x) => x.id === qid);
      if (!question) continue;
      if (question.kind === "choice") {
        for (const oid of drft.selectedOptionIds ?? []) {
          const opt = question.options.find((o) => o.id === oid);
          opt?.reveal_question_ids?.forEach((r) => revealed.add(r));
        }
      } else if (question.kind === "like" && drft.liked != null) {
        question.options[0]?.reveal_question_ids?.forEach((r) => revealed.add(r));
      }
    }
    const revealTargets = new Set<string>();
    for (const x of all) {
      for (const o of x.options) o.reveal_question_ids?.forEach((r) => revealTargets.add(r));
    }
    return all.filter((x) => !revealTargets.has(x.id) || revealed.has(x.id));
  }, [snapshot.questions, answers, readyToGo]);

  const total = visibleQuestions.length;
  const q = visibleQuestions[idx];
  const draft = answers[q?.id] ?? {};

  const canAdvance = React.useMemo(() => {
    if (!q) return false;
    if (readyToGo) return true; // free navigation — no answer required
    if (q.kind === "message") return true;
    if (q.kind === "choice") return (draft.selectedOptionIds?.length ?? 0) > 0;
    if (q.kind === "like") return draft.liked !== undefined && draft.liked !== null;
    if (q.kind === "answer") return !!draft.commentText?.trim() || !!draft.textValue?.trim();
    return false;
  }, [q, draft, readyToGo]);

  function patch(p: AnswerDraft) {
    setAnswers((a) => ({ ...a, [q.id]: { ...a[q.id], ...p } }));
  }

  function go(nextIdx: number) {
    setTick((x) => x + 1);
    setIdx(Math.max(0, Math.min(total - 1, nextIdx)));
  }

  async function persistCurrent() {
    // Ready-to-go briefs never collect responses.
    if (readyToGo || !responseId) return;
    if (!q || q.kind === "message") return;
    const isAnswerKind = q.kind === "answer";
    await fetch(`/api/client/${slug}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        responseId,
        questionId: q.id,
        kind: q.kind,
        selectedOptionIds: draft.selectedOptionIds ?? null,
        liked: draft.liked ?? null,
        textValue: isAnswerKind ? (draft.commentText ?? null) : (draft.textValue ?? null),
        commentText: isAnswerKind ? null : (draft.commentText ?? null),
        commentAttachments: draft.commentAttachments ?? [],
      }),
    });
  }

  async function next() {
    await persistCurrent();
    if (idx + 1 < total) {
      go(idx + 1);
      return;
    }
    // Ready-to-go has no submission step — Next on the last screen is a no-op.
    if (readyToGo) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/client/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseId }),
      });
      if (!res.ok) throw new Error("Submit failed");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
      setSubmitting(false);
    }
  }
  function back() { go(idx - 1); }

  // Keyboard nav
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxOption) return;
      if (e.key === "ArrowRight") (isRtl ? back : next)();
      else if (e.key === "ArrowLeft") (isRtl ? next : back)();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, isRtl, lightboxOption, canAdvance]);

  if (!q) return null;

  const headerAlign = isRtl ? "end" : "start";
  const isOpenAnswer = q.kind === "answer";
  const isMessage = q.kind === "message";

  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        position: "relative",
        padding: `${VIEWPORT_MARGIN}px ${VIEWPORT_MARGIN}px ${VIEWPORT_MARGIN + 60}px`,
        minHeight: 0,
      }}
    >
      {/* Side nav arrows (RTL-aware) */}
      <SideArrow
        side={isRtl ? "right" : "left"}
        disabled={idx === 0}
        onClick={back}
        label="Back"
      />
      <SideArrow
        side={isRtl ? "left" : "right"}
        disabled={(readyToGo ? idx + 1 === total : !canAdvance) || submitting}
        onClick={next}
        label={readyToGo ? "Next" : idx + 1 === total ? "Submit" : "Next"}
        primary={!readyToGo && idx + 1 === total}
        loading={submitting}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${q.id}-${tick}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
            // Open answer + message: center the header. Brief (ready-to-go)
            // read-only view centers everything too. Otherwise top-aligned to start.
            alignItems: isOpenAnswer || isMessage || readyToGo ? "center" : headerAlign,
            justifyContent: isOpenAnswer || isMessage ? "center" : "flex-start",
            textAlign: isOpenAnswer || isMessage || readyToGo ? "center" : headerAlign,
            width: "100%",
          }}
        >
          {/* Question / chapter heading */}
          {isMessage ? (
            <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <span className="eyebrow">Chapter {idx + 1}</span>
              <h2 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>{q.title}</h2>
              {q.helper && (
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 480 }}>
                  {q.helper}
                </p>
              )}
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
                Continue when ready →
              </span>
            </div>
          ) : (
            <div
              style={{
                maxWidth: isOpenAnswer ? 600 : "100%",
                display: "flex", flexDirection: "column",
                alignItems: isOpenAnswer || readyToGo ? "center" : "stretch",
                textAlign: isOpenAnswer || readyToGo ? "center" : headerAlign,
                width: "100%",
              }}
            >
              <h1
                style={{
                  fontSize: readyToGo ? 30 : 16,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  letterSpacing: readyToGo ? "-0.02em" : "-0.01em",
                  marginBottom: readyToGo ? 10 : 6,
                }}
              >
                {q.title || "Untitled question"}
              </h1>
              {q.helper && (
                <p style={{ fontSize: readyToGo ? 16 : 13, color: "var(--text-2)", lineHeight: 1.55 }}>
                  {q.helper}
                </p>
              )}
            </div>
          )}

          {/* Answer surface */}
          <div style={{ width: "100%", maxWidth: 980, marginTop: 24, display: "flex", justifyContent: "center" }}>
            {readyToGo ? (
              // Read-only content: every option of every kind is shown as a card.
              q.options.length > 0 && (
                <ChoiceGrid
                  q={q}
                  draft={draft}
                  onPatch={() => {}}
                  onZoom={(o) => setLightboxOption(o)}
                  readOnly
                />
              )
            ) : (
              <>
                {q.kind === "choice" && (
                  <ChoiceGrid
                    q={q}
                    draft={draft}
                    onPatch={patch}
                    onZoom={(o) => setLightboxOption(o)}
                  />
                )}
                {q.kind === "like" && (
                  <LikePanel
                    q={q}
                    draft={draft}
                    onPatch={patch}
                    onZoom={(o) => setLightboxOption(o)}
                  />
                )}
              </>
            )}
          </div>

          {/* Editor handoff — in the brief (ready-to-go) view it sits below the
              cards, centered, so viewers see the references first. */}
          {readyToGo && (
            <div style={{ width: "100%", maxWidth: 640, marginTop: 28, display: "flex", justifyContent: "center" }}>
              <InlineHandoff settings={q.settings} attachments={q.attachments} align="center" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom-center comment composer — hidden in ready-to-go (read-only) mode */}
      {!isMessage && !readyToGo && (
        <div
          style={{
            position: "absolute",
            insetBlockEnd: 24,
            insetInlineStart: 0, insetInlineEnd: 0,
            display: "flex", justifyContent: "center",
            padding: "0 24px",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "100%", maxWidth: 640, pointerEvents: "auto" }}>
            <CommentComposer
              compact
              slug={slug}
              guidelineId={guidelineId}
              value={draft.commentText ?? ""}
              attachments={draft.commentAttachments ?? []}
              onChange={(p) => patch(p)}
              onSubmit={next}
              submitDisabled={!canAdvance || submitting}
              showBack={false}
              onBack={back}
              isLast={idx + 1 === total}
              submitting={submitting}
              placeholder={
                q.kind === "answer"
                  ? "Type your answer here…"
                  : "Add a note, paste references, or attach files…"
              }
            />
          </div>
        </div>
      )}

      {/* Tiny step indicator (subtle, bottom-center top of composer area) */}
      <div
        style={{
          position: "absolute",
          insetBlockStart: VIEWPORT_MARGIN - 26,
          insetInlineStart: VIEWPORT_MARGIN,
          fontSize: 11,
          letterSpacing: ".08em",
          color: "var(--text-3)",
          textTransform: "uppercase",
        }}
        dir="ltr"
      >
        {idx + 1} / {total}
      </div>

      <Lightbox option={lightboxOption} onClose={() => setLightboxOption(null)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inline editor handoff — only shown in ready-to-go mode, under the question.
// 50% opacity box with a 1px dashed stroke (per spec).
// ────────────────────────────────────────────────────────────────────────────
function InlineHandoff({
  settings,
  attachments,
  align,
}: {
  settings: SettingCell[];
  attachments: Attachment[];
  align: "start" | "end" | "center";
}) {
  const cells = (settings ?? []).filter((c) => c.label || c.value);
  const files = attachments ?? [];
  if (cells.length === 0 && files.length === 0) return null;

  const justify = align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start";

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "var(--r-lg)",
        border: "1px dashed var(--border-2)",
        background: "var(--surface)",
        textAlign: align,
        maxWidth: 560,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: cells.length || files.length ? 12 : 0,
          justifyContent: justify,
        }}
      >
        <Layers size={14} />
        <span className="eyebrow" style={{ color: "var(--text-2)" }}>Editor handoff</span>
      </div>

      {cells.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cells.map((c) => (
            <div
              key={c.id}
              style={{
                // Label pinned left, value (+ copy) pinned right.
                display: "flex", gap: 12, alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "left", flexShrink: 0 }}
              >
                {c.label}
              </span>
              {c.value ? (
                <CopyableValue value={c.value} />
              ) : (
                <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>—</span>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div
          style={{
            display: "flex", flexWrap: "wrap", gap: 8, marginTop: cells.length ? 14 : 0,
            justifyContent: justify,
          }}
        >
          {files.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{
                fontSize: 11.5, padding: "6px 10px", borderRadius: 8,
                background: "var(--surface-2)", border: "1px solid var(--border-raw)",
                color: "var(--text-2)", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 7,
              }}
            >
              {f.kind === "lut" ? <Sparkles size={13} /> : <Paperclip size={13} />}
              {f.name}
              <Download size={12} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Right-aligned handoff value with a click-to-copy icon (e.g. a hex color code).
function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      aria-label={`Copy ${value}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        marginInlineStart: "auto",
        background: "transparent", border: "none", padding: 0,
        cursor: "pointer", color: "var(--text)",
        fontSize: 13.5, fontWeight: 500, textAlign: "right",
      }}
    >
      <span>{value}</span>
      {copied ? (
        <Check size={13} style={{ color: "var(--accent, currentColor)" }} />
      ) : (
        <Copy size={13} style={{ color: "var(--text-3)" }} />
      )}
    </button>
  );
}

function SideArrow({
  side,
  disabled,
  onClick,
  label,
  primary,
  loading,
}: {
  side: "left" | "right";
  disabled?: boolean;
  onClick: () => void;
  label: string;
  primary?: boolean;
  loading?: boolean;
}) {
  const ArrowIcon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        position: "absolute",
        insetBlockStart: "50%",
        [side === "left" ? "insetInlineStart" : "insetInlineEnd"]: 14,
        transform: "translateY(-50%)",
        width: 44, height: 44, borderRadius: 99,
        background: primary && !disabled ? "var(--accent)" : "var(--surface)",
        color: primary && !disabled ? "var(--accent-contrast)" : (disabled ? "var(--text-3)" : "var(--text-2)"),
        border: "1px solid",
        borderColor: primary && !disabled ? "transparent" : "var(--border-raw)",
        boxShadow: primary && !disabled ? "var(--glow)" : "var(--shadow-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        zIndex: 10,
        transition: "all .15s ease",
      } as React.CSSProperties}
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : <ArrowIcon size={18} />}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Choice grid
// ────────────────────────────────────────────────────────────────────────────
function ChoiceGrid({
  q,
  draft,
  onPatch,
  onZoom,
  readOnly = false,
}: {
  q: Question;
  draft: AnswerDraft;
  onPatch: (p: AnswerDraft) => void;
  onZoom: (o: Option) => void;
  readOnly?: boolean;
}) {
  const sel = new Set(draft.selectedOptionIds ?? []);
  const count = q.options.length;
  // Always centered, up to 4 per row.
  const cols = Math.min(count, 4);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        alignItems: "start",
        gap: 14,
        width: "100%",
        maxWidth: cols >= 4 ? 980 : cols === 3 ? 760 : cols === 2 ? 560 : 320,
      }}
    >
      {q.options.map((o) => {
        const selected = !readOnly && sel.has(o.id);
        return (
          <ChoiceCard
            key={o.id}
            opt={o}
            selected={selected}
            readOnly={readOnly}
            onClick={() => { if (!readOnly) onPatch({ selectedOptionIds: [o.id] }); }}
            onZoom={() => onZoom(o)}
          />
        );
      })}
    </div>
  );
}

function ChoiceCard({
  opt,
  selected,
  onClick,
  onZoom,
  readOnly = false,
}: {
  opt: Option;
  selected: boolean;
  onClick: () => void;
  onZoom: () => void;
  readOnly?: boolean;
}) {
  const isText = opt.media_kind === "text" || !opt.media_url;
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: "var(--surface)",
        border: "2px solid",
        borderColor: selected ? "var(--accent)" : "var(--border-raw)",
        // Softer, more spread shadow for the brief cards (vs. the tight --shadow-sm).
        boxShadow: selected
          ? "var(--glow), 0 18px 50px -12px rgba(16,24,40,.18), 0 6px 18px -8px rgba(16,24,40,.10)"
          : "0 12px 40px -14px rgba(16,24,40,.14), 0 4px 14px -8px rgba(16,24,40,.08)",
        transition: "all .18s ease",
        transform: selected ? "translateY(-2px)" : "none",
      }}
    >
      <button
        onClick={onClick}
        disabled={readOnly}
        style={{
          display: "block", width: "100%", textAlign: "start",
          background: "transparent", border: "none", padding: 0,
          cursor: readOnly ? "default" : "pointer",
        }}
      >
        {selected && (
          <div
            style={{
              position: "absolute", top: 8, insetInlineEnd: 8, zIndex: 2,
              width: 22, height: 22, borderRadius: 99,
              background: "var(--accent)", color: "var(--accent-contrast)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--glow)",
            }}
          >
            <Check size={12} strokeWidth={3} />
          </div>
        )}
        {isText ? (
          <div style={{ padding: "22px 18px", minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{opt.label || "Option"}</div>
          </div>
        ) : (
          <OptionMedia opt={opt} fit="cover" />
        )}
        {!isText && opt.label && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-raw)" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
          </div>
        )}
      </button>
      {!isText && (
        <button
          onClick={(e) => { e.stopPropagation(); onZoom(); }}
          title="Open full size"
          aria-label="Open full size"
          style={{
            position: "absolute", top: 8, insetInlineStart: 8,
            width: 26, height: 26, borderRadius: 99,
            background: "rgba(0,0,0,.6)", color: "#fff",
            border: "none", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <Maximize2 size={12} />
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Like panel
// ────────────────────────────────────────────────────────────────────────────
function LikePanel({
  q,
  draft,
  onPatch,
  onZoom,
}: {
  q: Question;
  draft: AnswerDraft;
  onPatch: (p: AnswerDraft) => void;
  onZoom: (o: Option) => void;
}) {
  const opt = q.options[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, maxWidth: 560, width: "100%" }}>
      {opt && (
        <div
          style={{
            width: "100%", borderRadius: "var(--r-lg)", overflow: "hidden",
            border: "1px solid var(--border-raw)", background: "var(--surface)",
            position: "relative",
          }}
        >
          <OptionMedia opt={opt} fit="contain" maxHeight={420} />
          <button
            onClick={() => onZoom(opt)}
            title="Open full size"
            aria-label="Open full size"
            style={{
              position: "absolute", top: 8, insetInlineStart: 8,
              width: 28, height: 28, borderRadius: 99,
              background: "rgba(0,0,0,.6)", color: "#fff",
              border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
            }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 14 }}>
        <LikeBtn active={draft.liked === false} tone="no" onClick={() => onPatch({ liked: false })} />
        <LikeBtn active={draft.liked === true}  tone="yes" onClick={() => onPatch({ liked: true })} />
      </div>
    </div>
  );
}

function LikeBtn({
  active, tone, onClick,
}: { active: boolean; tone: "yes" | "no"; onClick: () => void }) {
  const yes = tone === "yes";
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: "14px 22px",
        borderRadius: "var(--r-md)",
        background: active ? (yes ? "var(--accent)" : "var(--surface)") : "var(--surface)",
        border: "2px solid",
        borderColor: active ? (yes ? "var(--accent)" : "var(--danger)") : "var(--border-raw)",
        color: active ? (yes ? "var(--accent-contrast)" : "var(--danger)") : "var(--text-2)",
        boxShadow: active && yes ? "var(--glow)" : "var(--shadow-sm)",
        transition: "all .16s ease",
        minWidth: 110,
        transform: active ? "translateY(-2px)" : "none",
        cursor: "pointer",
        fontSize: 13, fontWeight: 600,
      }}
    >
      {yes ? <ThumbsUp size={22} /> : <ThumbsDown size={22} />}
      <span>{yes ? "I like it" : "Not for me"}</span>
    </button>
  );
}

// Mux stores aspect ratio as a "W:H" string (e.g. "16:9"); turn it into a CSS
// aspect-ratio value, defaulting to 16/9 when it's missing or unparseable.
function muxAspectRatio(meta: Record<string, unknown> | undefined): string {
  const raw = meta?.aspect_ratio;
  if (typeof raw === "string") {
    const m = raw.match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);
    if (m && Number(m[1]) > 0 && Number(m[2]) > 0) return `${m[1]} / ${m[2]}`;
  }
  return "16 / 9";
}

// ────────────────────────────────────────────────────────────────────────────
// Media renderer — supports both cover (card) and contain (lightbox + like)
// ────────────────────────────────────────────────────────────────────────────
function OptionMedia({
  opt,
  fit,
  maxHeight,
}: {
  opt: Option;
  fit: "cover" | "contain";
  maxHeight?: number;
}) {
  if (!opt.media_url || opt.media_kind === "text") {
    return (
      <div
        style={{
          width: "100%", aspectRatio: "4/3",
          background: "var(--bg-2)", color: "var(--text-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, padding: 12,
        }}
      >
        <TypeIcon size={20} />
      </div>
    );
  }
  if (opt.media_kind === "video" && opt.media_provider === "mux") {
    // Use the source video's real aspect ratio (stored by the upload poller)
    // so the card matches the uploaded video instead of a fixed 16/9 box.
    const ratio = muxAspectRatio(opt.media_meta);
    const isPending = opt.media_url.length > 40;
    if (isPending) {
      return (
        <div style={{ width: "100%", aspectRatio: ratio, background: "#000", color: "rgba(255,255,255,.7)", display: "grid", placeItems: "center" }}>
          <Loader2 className="animate-spin" size={18} />
        </div>
      );
    }
    return (
      <div style={{ width: "100%", aspectRatio: ratio, background: "#000", overflow: "hidden" }}>
        <MuxPlayer
          playbackId={opt.media_url}
          streamType="on-demand"
          accentColor="#00BE43"
          metadata={{ video_title: opt.label ?? "" }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }
  // Animated reference — a short clip rendered as a controls-free muted
  // autoplay loop (also covers legacy looping WebMs).
  const isLoopingVideo =
    opt.media_kind === "gif" && /\.(webm|mp4|mov|m4v)($|\?)/i.test(opt.media_url);
  if (isLoopingVideo) {
    if (fit === "contain") {
      return (
        <div
          style={{
            width: "100%", maxHeight: maxHeight ?? 420,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-2)",
          }}
        >
          <video
            src={opt.media_url}
            muted loop autoPlay playsInline
            style={{ maxWidth: "100%", maxHeight: maxHeight ?? 420, width: "auto", height: "auto", objectFit: "contain", display: "block" }}
          />
        </div>
      );
    }
    // Cover (cards) — render at the clip's natural aspect ratio; fills card width.
    return (
      <div style={{ width: "100%", background: "var(--bg-2)", lineHeight: 0 }}>
        <video
          src={opt.media_url}
          muted loop autoPlay playsInline
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>
    );
  }
  // Bunny / external image or gif
  if (fit === "contain") {
    return (
      <div
        style={{
          width: "100%",
          maxHeight: maxHeight ?? 420,
          aspectRatio: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-2)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={opt.media_url}
          alt={opt.label ?? ""}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: maxHeight ?? 420,
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }
  // Cover (cards) — render the image at its natural aspect ratio so the card
  // sizes to the uploaded media; the image fills the card's full width.
  return (
    <div style={{ width: "100%", background: "var(--bg-2)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={opt.media_url}
        alt={opt.label ?? ""}
        style={{ display: "block", width: "100%", height: "auto" }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Lightbox — 70% dark backdrop with play/pause for videos
// ────────────────────────────────────────────────────────────────────────────
function Lightbox({
  option,
  onClose,
}: {
  option: Option | null;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!option) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [option, onClose]);

  if (!option) return null;
  const isVideo = option.media_kind === "video";
  const isLoopingVideo =
    option.media_kind === "gif" && !!option.media_url && /\.(webm|mp4|mov|m4v)($|\?)/i.test(option.media_url);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.7)",
          zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 18, insetInlineEnd: 18,
            width: 38, height: 38, borderRadius: 99,
            background: "rgba(255,255,255,.12)", color: "#fff",
            border: "none", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <XIcon size={18} />
        </button>

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "90vw", maxHeight: "85vh",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 14,
          }}
        >
          {isVideo && option.media_provider === "mux" && option.media_url && option.media_url.length <= 40 ? (
            <div style={{ width: "90vw", maxWidth: 1280, aspectRatio: "16/9", background: "#000" }}>
              <MuxPlayer
                playbackId={option.media_url}
                streamType="on-demand"
                accentColor="#00BE43"
                autoPlay="muted"
                metadata={{ video_title: option.label ?? "" }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ) : isLoopingVideo ? (
            <video
              ref={videoRef}
              src={option.media_url ?? ""}
              muted loop autoPlay playsInline
              style={{
                maxWidth: "90vw", maxHeight: "78vh",
                objectFit: "contain", display: "block",
                borderRadius: 8, background: "#000",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={option.media_url ?? ""}
              alt={option.label ?? ""}
              style={{
                maxWidth: "90vw", maxHeight: "78vh",
                objectFit: "contain", display: "block",
                borderRadius: 8, background: "#000",
              }}
            />
          )}
          {option.label && (
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 500, textAlign: "center" }}>
              {option.label}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
