"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Eye, Loader2, CheckCircle2, Copy, ChevronLeft,
  Grid3X3, Heart, MessageSquare, Trash2, X, Layers, Sparkles, Paperclip,
  Megaphone, Filter, GripVertical, Share2, Rocket,
} from "lucide-react";
import {
  useBuilder,
  type BuilderGuideline,
  type BuilderQuestion,
  type QuestionKind,
} from "@/lib/guideline/store";
import type { SettingCell, Attachment } from "@/lib/supabase/database.types";
import { Switch } from "@/components/ui/switch";
import { ShareDialog } from "./share-dialog";
import { MediaPicker } from "./media-picker";
import { absoluteUrl } from "@/lib/utils";
import { nanoid } from "nanoid";

const Q_TYPES: { type: QuestionKind; label: string; icon: React.ComponentType<{ size?: number }>; desc: string }[] = [
  { type: "choice",  label: "Choice between options", icon: Grid3X3,       desc: "Client picks from visual options" },
  { type: "like",    label: "Like / not",             icon: Heart,         desc: "Quick yes-or-no gut reaction" },
  { type: "answer",  label: "Open answer",            icon: MessageSquare, desc: "Free-text, in their own words" },
  { type: "message", label: "Message / Chapter",      icon: Megaphone,     desc: "A short note between sections" },
];

export function GuidelineBuilder({
  initialGuideline,
  initialQuestions,
}: {
  initialGuideline: BuilderGuideline;
  initialQuestions: BuilderQuestion[];
}) {
  const {
    guideline,
    questions,
    selectedQuestionId,
    dirty,
    hydrate,
    setMeta,
    addQuestion,
    selectQuestion,
    markClean,
  } = useBuilder();

  React.useEffect(() => {
    hydrate(initialGuideline, initialQuestions);
    if (initialQuestions[0]) selectQuestion(initialQuestions[0].id);
  }, [initialGuideline, initialQuestions, hydrate, selectQuestion]);

  const [saving, setSaving] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [addingAnchor, setAddingAnchor] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save({ silent: true }), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, guideline, questions]);

  async function save(opts: { silent?: boolean; publish?: boolean } = {}) {
    if (!guideline) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/guidelines/${guideline.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guideline: {
            title: guideline.title,
            description: guideline.description,
            cover_color: guideline.cover_color,
            one_question_per_screen: guideline.one_question_per_screen,
            ready_to_go: guideline.ready_to_go,
            password_hash: guideline.password_hash,
          },
          questions,
          publish: !!opts.publish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      markClean();
      if (opts.publish) {
        setMeta({ status: "published" });
        if (!opts.silent) setShareOpen(true);
      }
      if (!opts.silent) toast.success(opts.publish ? "Published" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!guideline?.share_slug) return;
    navigator.clipboard.writeText(absoluteUrl(`/c/${guideline.share_slug}`));
    toast.success(
      `Link copied · ${guideline.password_hash ? "password protected" : "public"}`,
    );
  }

  if (!guideline) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-3)" }}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const selected = questions.find((q) => q.id === selectedQuestionId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Builder top bar */}
      <div
        style={{
          height: 56,
          flexShrink: 0,
          padding: "0 20px",
          borderBottom: "1px solid var(--border-raw)",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <Link
            href="/app/guidelines"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "var(--r-md)", color: "var(--text-2)",
              background: "transparent", textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <ChevronLeft size={18} />
          </Link>
          <h2 style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {guideline.title || "Untitled brief"}
          </h2>
          <StatusBadge status={guideline.status} dirty={dirty} saving={saving} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ToolbarButton onClick={copyLink} icon={<Copy size={15} />}>Copy link</ToolbarButton>
          <ToolbarButton onClick={() => setShareOpen(true)} icon={<Share2 size={15} />}>Share</ToolbarButton>
          <ToolbarButton
            variant="primary"
            onClick={() => save({ publish: true })}
            icon={saving ? <Loader2 className="animate-spin" size={15} /> : <Eye size={15} />}
          >
            {guideline.status === "published" ? "Update & publish" : "Save & publish"}
          </ToolbarButton>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Question list */}
        <aside
          style={{
            width: 320,
            flexShrink: 0,
            borderInlineEnd: "1px solid var(--border-raw)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg)",
          }}
        >
          <div style={{ padding: "18px 18px 12px" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </div>
            <input
              value={guideline.title}
              placeholder="Untitled brief"
              onChange={(e) => setMeta({ title: e.target.value })}
              style={{
                width: "100%",
                fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em",
                background: "transparent", border: "none", padding: 0, marginBottom: 4,
                color: "var(--text)",
              }}
            />
            <div className="muted" style={{ fontSize: 13 }}>{guideline.description || "Add a description in settings"}</div>

            <ReadyToGoToggle
              checked={guideline.ready_to_go}
              onChange={(v) => setMeta({ ready_to_go: v })}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
            <QuestionList />
            <div style={{ position: "relative", marginTop: 10 }}>
              <button
                onClick={(e) => setAddingAnchor(addingAnchor ? null : e.currentTarget)}
                style={{
                  width: "100%", padding: 12,
                  borderRadius: "var(--r-md)",
                  border: "1.5px dashed var(--border-2)",
                  background: "transparent",
                  color: "var(--text-2)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                }}
              >
                <Plus size={16} /> Add question
              </button>
              {addingAnchor && (
                <AddQuestionDropdown
                  onAdd={(kind) => { addQuestion(kind); setAddingAnchor(null); }}
                  onClose={() => setAddingAnchor(null)}
                />
              )}
            </div>
          </div>
        </aside>

        {/* Editor pane */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
          {selected ? (
            <QuestionEditor key={selected.id} question={selected} guidelineId={guideline.id} />
          ) : (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: "100%", color: "var(--text-3)", gap: 10,
              }}
            >
              <Layers size={32} />
              <span>No question selected</span>
            </div>
          )}
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        guidelineId={guideline.id}
        slug={guideline.share_slug ?? ""}
        hasPassword={!!guideline.password_hash}
      />
    </div>
  );
}

function StatusBadge({
  status,
  dirty,
  saving,
}: {
  status: "draft" | "published" | "archived";
  dirty: boolean;
  saving: boolean;
}) {
  if (saving) {
    return (
      <span
        className="mono"
        style={{
          fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
          padding: "3px 8px", borderRadius: 99,
          background: "var(--bg-2)", color: "var(--text-2)",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}
      >
        <Loader2 className="animate-spin" size={11} /> Saving
      </span>
    );
  }
  if (dirty) {
    return (
      <span
        className="mono"
        style={{
          fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
          padding: "3px 8px", borderRadius: 99,
          background: "rgba(245,166,35,.14)", color: "#b9770e",
        }}
      >
        Unsaved
      </span>
    );
  }
  return (
    <span
      className="mono"
      style={{
        fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
        padding: "3px 8px", borderRadius: 99,
        background: status === "published" ? "var(--accent-weak)" : "var(--bg-2)",
        color: status === "published" ? "var(--accent-ink)" : "var(--text-3)",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}
    >
      {status === "published" && <CheckCircle2 size={11} />} {status === "published" ? "Live" : status}
    </span>
  );
}

function ReadyToGoToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "11px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid",
        borderColor: checked ? "var(--accent)" : "var(--border-raw)",
        background: checked ? "var(--accent-weak)" : "var(--surface-2)",
        display: "flex", alignItems: "flex-start", gap: 10,
        transition: "all .18s ease",
      }}
    >
      <span
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: checked ? "var(--accent)" : "var(--bg-2)",
          color: checked ? "var(--accent-contrast)" : "var(--text-2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: checked ? "var(--glow)" : "none",
        }}
      >
        <Rocket size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Ready-to-go guideline</span>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}>
          A reference doc for your editor — no client picks. Options show as content,
          handoff is shown inline, viewers just read &amp; navigate freely.
        </p>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  icon,
  variant = "default",
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "primary";
  onClick?: () => void;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "7px 12px", borderRadius: "var(--r-md)",
        fontWeight: 550, fontSize: 13, letterSpacing: "-0.01em",
        background: isPrimary ? "var(--accent)" : "var(--surface)",
        color: isPrimary ? "var(--accent-contrast)" : "var(--text)",
        border: "1px solid",
        borderColor: isPrimary ? "transparent" : "var(--border-2)",
        boxShadow: isPrimary ? "var(--glow)" : "var(--shadow-sm)",
        cursor: "pointer",
      }}
    >
      {icon} {children}
    </button>
  );
}

function AddQuestionDropdown({
  onAdd,
  onClose,
}: {
  onAdd: (kind: QuestionKind) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {Q_TYPES.map((qt, i) => {
        const Icon = qt.icon;
        return (
          <button
            key={qt.type}
            onClick={() => onAdd(qt.type)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", width: "100%", textAlign: "start",
              background: "transparent", border: "none",
              borderTop: i === 0 ? "none" : "1px solid var(--border-raw)",
              cursor: "pointer", transition: "background .1s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: "var(--bg-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-2)", flexShrink: 0,
              }}
            >
              <Icon size={14} />
            </span>
            <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text)" }}>{qt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function QuestionList() {
  const { questions, selectedQuestionId, selectQuestion, removeQuestion, reorderQuestion } = useBuilder();
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <p style={{ padding: "24px 12px", textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
        No questions yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {questions.map((q, i) => {
        const Icon =
          q.kind === "choice"  ? Grid3X3 :
          q.kind === "like"    ? Heart   :
          q.kind === "message" ? Megaphone :
          MessageSquare;
        const hasHandoff = (q.settings?.length ?? 0) > 0 ||
          q.options.some((o) => (o.settings?.length ?? 0) > 0);
        const selected = selectedQuestionId === q.id;
        const isDragging = dragging === q.id;
        const isOver = dragOver === q.id;

        return (
          <div
            key={q.id}
            draggable
            onDragStart={() => setDragging(q.id)}
            onDragEnd={() => { setDragging(null); setDragOver(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(q.id); }}
            onDrop={() => {
              if (dragging && dragging !== q.id) {
                reorderQuestion(dragging, q.id);
              }
              setDragOver(null);
            }}
            style={{
              display: "flex", alignItems: "flex-start", gap: 4,
              borderRadius: "var(--r-md)",
              opacity: isDragging ? 0.4 : 1,
              outline: isOver ? "2px solid var(--accent)" : "none",
              outlineOffset: 1,
              transition: "opacity .12s, outline .1s",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 42, flexShrink: 0, cursor: "grab", paddingTop: 2,
                color: "var(--text-3)",
              }}
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </div>
            <button
              onClick={() => selectQuestion(q.id)}
              style={{
                flex: 1, display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 10px 10px 4px",
                borderRadius: "var(--r-md)", textAlign: "start",
                border: "1px solid",
                borderColor: selected ? "var(--border-2)" : "transparent",
                background: selected ? "var(--surface)" : "transparent",
                boxShadow: selected ? "var(--shadow-sm)" : "none",
                cursor: "pointer",
                transition: "all .14s ease",
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, minWidth: 16 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <Icon size={13} />
                  <span
                    className="mono"
                    style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" }}
                  >
                    {q.kind === "answer" ? "open" : q.kind === "message" ? "chapter" : q.kind}
                  </span>
                  {hasHandoff && (
                    <span
                      title="Has editor handoff"
                      style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)", boxShadow: "var(--glow)" }}
                    />
                  )}
                </span>
                <span
                  style={{
                    fontSize: 13, fontWeight: 500, lineHeight: 1.35, display: "block",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    color: "var(--text)",
                  }}
                >
                  {q.title || "Untitled question"}
                </span>
              </span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
              title="Delete question"
              style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0, alignSelf: "flex-start", marginTop: 8,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function QuestionEditor({
  question,
  guidelineId,
}: {
  question: BuilderQuestion;
  guidelineId: string;
}) {
  const { guideline, updateQuestion, addOption, updateOption, removeOption } = useBuilder();
  const readyToGo = !!guideline?.ready_to_go;
  // In ready-to-go mode every question kind (except chapters) is just a list of
  // content options — selection is disabled, so we reuse the choice options editor.
  const showOptionList = question.kind === "choice" || (readyToGo && question.kind !== "message");
  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "30px 30px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <span
          className="mono"
          style={{
            fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
            padding: "3px 8px", borderRadius: 99,
            background: "var(--accent-weak)", color: "var(--accent-ink)",
          }}
        >
          {question.kind === "answer" ? "open answer" : question.kind === "message" ? "chapter" : question.kind}
        </span>
      </div>

      <Field label={question.kind === "message" ? "Message to the client" : "Question prompt"}>
        <input
          value={question.title}
          placeholder={question.kind === "message"
            ? "e.g. Now let's look at color grading…"
            : "Type the question…"}
          onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
          style={{ ...editInput, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}
        />
      </Field>

      <Field label={question.kind === "message" ? "Sub-text (optional)" : "Help text (optional)"}>
        <input
          value={question.helper}
          placeholder={question.kind === "message"
            ? "Optional paragraph shown under the message…"
            : "Add a hint for the client…"}
          onChange={(e) => updateQuestion(question.id, { helper: e.target.value })}
          style={editInput}
        />
      </Field>

      {question.kind === "message" && (
        <div
          style={{
            marginTop: 18,
            padding: "14px 16px",
            background: "var(--accent-weak)",
            border: "1px dashed var(--accent)",
            borderRadius: "var(--r-md)",
            color: "var(--accent-ink)",
            fontSize: 12.5,
            display: "flex", alignItems: "center", gap: 9,
          }}
        >
          <Megaphone size={14} />
          Chapter blocks appear between questions as a full-screen message. They don&apos;t collect a response.
        </div>
      )}

      {readyToGo && question.kind !== "message" && (
        <div
          style={{
            marginTop: 18,
            padding: "11px 14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-2)",
            borderRadius: "var(--r-md)",
            color: "var(--text-2)",
            fontSize: 12.5,
            display: "flex", alignItems: "center", gap: 9,
          }}
        >
          <Rocket size={14} />
          Ready-to-go mode — these are shown as read-only content. The viewer can&apos;t pick.
        </div>
      )}

      {showOptionList && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "26px 0 12px" }}>
            <label className="eyebrow">{readyToGo ? "Content" : "Options"}</label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {question.options.map((o) => (
              <div
                key={o.id}
                style={{
                  border: "1px solid var(--border-raw)", borderRadius: "var(--r-md)",
                  padding: 14, background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 100, height: 76, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-raw)" }}>
                    <MediaPicker
                      mediaKind={o.media_kind}
                      mediaUrl={o.media_url}
                      mediaProvider={o.media_provider ?? null}
                      mediaMeta={o.media_meta}
                      guidelineId={guidelineId}
                      onChange={(patch) => updateOption(question.id, o.id, patch)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      value={o.label}
                      placeholder="Option label"
                      onChange={(e) => updateOption(question.id, o.id, { label: e.target.value })}
                      style={{ ...editInput, fontWeight: 600, fontSize: 15 }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      {(["image", "gif", "video", "text"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() =>
                            updateOption(question.id, o.id, {
                              media_kind: m,
                              media_url: null,
                              media_provider: null,
                            })
                          }
                          className="mono"
                          style={mediaChip(o.media_kind === m)}
                        >
                          {mediaKindLabel(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => removeOption(question.id, o.id)}
                    title="Remove option"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      color: "var(--text-3)", background: "transparent", border: "none",
                      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
                {!readyToGo && (
                  <RevealPicker
                    currentQuestionId={question.id}
                    optionId={o.id}
                    selected={o.reveal_question_ids ?? []}
                    onChange={(ids) => updateOption(question.id, o.id, { reveal_question_ids: ids })}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => addOption(question.id)}
            style={{
              marginTop: 12, padding: "10px 14px",
              borderRadius: "var(--r-md)", border: "1.5px dashed var(--border-2)",
              color: "var(--text-2)", display: "flex", alignItems: "center", gap: 8,
              fontSize: 13.5, fontWeight: 500, background: "transparent", cursor: "pointer",
            }}
          >
            <Plus size={15} /> Add option
          </button>
        </>
      )}

      {question.kind === "like" && !readyToGo && (
        <Field label="Reference media" style={{ marginTop: 26 }}>
          {question.options[0] ? (
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 220, height: 130, borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--border-raw)" }}>
                <MediaPicker
                  mediaKind={question.options[0].media_kind}
                  mediaUrl={question.options[0].media_url}
                  mediaProvider={question.options[0].media_provider ?? null}
                  mediaMeta={question.options[0].media_meta}
                  guidelineId={guidelineId}
                  onChange={(patch) => updateOption(question.id, question.options[0].id, patch)}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  value={question.options[0].label}
                  placeholder="Describe the reference…"
                  onChange={(e) => updateOption(question.id, question.options[0].id, { label: e.target.value })}
                  style={editInput}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  {(["image", "gif", "video", "text"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        updateOption(question.id, question.options[0].id, {
                          media_kind: m,
                          media_url: null,
                          media_provider: null,
                        })
                      }
                      className="mono"
                      style={mediaChip(question.options[0].media_kind === m)}
                    >
                      {mediaKindLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => addOption(question.id, { media_kind: "image" })}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--r-md)", border: "1.5px dashed var(--border-2)",
                color: "var(--text-2)", background: "transparent", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5,
              }}
            >
              <Plus size={15} /> Add reference
            </button>
          )}
          {question.options[0] && (
            <RevealPicker
              currentQuestionId={question.id}
              optionId={question.options[0].id}
              selected={question.options[0].reveal_question_ids ?? []}
              onChange={(ids) =>
                updateOption(question.id, question.options[0].id, { reveal_question_ids: ids })
              }
              label="If the client reacts (👍 or 👎), also show…"
            />
          )}
        </Field>
      )}

      {question.kind !== "message" && (
        <HandoffEditor question={question} guidelineId={guidelineId} />
      )}
    </div>
  );
}

function HandoffEditor({
  question,
  guidelineId,
}: {
  question: BuilderQuestion;
  guidelineId: string;
}) {
  const { addSettingCell, updateSettingCell, removeSettingCell, addAttachment, removeAttachment } = useBuilder();
  const cells = question.settings ?? [];
  const files = question.attachments ?? [];
  const enabled = cells.length > 0 || files.length > 0;
  const [open, setOpen] = React.useState(enabled);
  React.useEffect(() => { if (enabled) setOpen(true); }, [enabled]);

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind: Attachment["kind"] =
        ext === "cube" ? "lut" :
        ["lrtemplate", "xmp", "preset", "json", "prfpset", "prproj"].includes(ext) ? "preset" :
        file.type.startsWith("image/") ? (file.type.includes("gif") ? "gif" : "image") :
        file.type.startsWith("video/") ? "video" :
        "file";

      const form = new FormData();
      form.append("file", file);
      form.append("guidelineId", guidelineId);
      form.append("kind", kind);
      const res = await fetch("/api/uploads/bunny", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      addAttachment({ type: "question", questionId: question.id }, {
        id: nanoid(8),
        name: json.name,
        url: json.url,
        kind: json.kind,
        size: json.size,
        provider: "bunny",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 34,
        borderRadius: "var(--r-lg)",
        border: "1px solid",
        borderColor: open ? "var(--accent)" : "var(--border-raw)",
        overflow: "hidden",
        background: open ? "var(--accent-weak)" : "var(--surface-2)",
        transition: "all .2s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", padding: "15px 18px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: open ? "var(--accent)" : "var(--bg-2)",
              color: open ? "var(--accent-contrast)" : "var(--text-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: open ? "var(--glow)" : "none",
            }}
          >
            <Layers size={17} />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Editor handoff</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Recipe to recreate this look — shared with your editor
            </div>
          </div>
        </div>
        <Switch checked={open} onCheckedChange={setOpen} />
      </div>

      {open && (
        <div style={{ padding: "4px 18px 18px" }} className="fade-only">
          <label className="eyebrow" style={{ display: "block", marginBottom: 10 }}>Settings cells</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cells.map((c: SettingCell) => (
              <div key={c.id} style={{ display: "flex", gap: 8 }}>
                <input
                  value={c.label}
                  placeholder="Label"
                  onChange={(e) =>
                    updateSettingCell({ type: "question", questionId: question.id }, c.id, {
                      label: e.target.value,
                    })
                  }
                  className="mono"
                  style={{
                    flex: "0 0 38%", padding: "9px 11px",
                    background: "var(--surface)", border: "1px solid var(--border-raw)",
                    borderRadius: 8, fontSize: 12.5, color: "var(--text)",
                  }}
                />
                <input
                  value={c.value}
                  placeholder="Value"
                  onChange={(e) =>
                    updateSettingCell({ type: "question", questionId: question.id }, c.id, {
                      value: e.target.value,
                    })
                  }
                  style={{
                    flex: 1, padding: "9px 11px",
                    background: "var(--surface)", border: "1px solid var(--border-raw)",
                    borderRadius: 8, fontSize: 13, color: "var(--text)",
                  }}
                />
                <button
                  onClick={() =>
                    removeSettingCell({ type: "question", questionId: question.id }, c.id)
                  }
                  style={{
                    width: 30, height: 30, border: "none", background: "transparent",
                    color: "var(--text-3)", cursor: "pointer", borderRadius: 6,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => addSettingCell({ type: "question", questionId: question.id })}
            style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--border-raw)",
              color: "var(--text-2)", display: "flex", alignItems: "center", gap: 7,
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add cell
          </button>

          <label className="eyebrow" style={{ display: "block", margin: "20px 0 10px" }}>
            Attachments — LUTs · presets · files · links
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {files.map((f: Attachment) => (
              <span
                key={f.id}
                className="mono"
                style={{
                  fontSize: 11.5, padding: "6px 10px", borderRadius: 8,
                  background: "var(--surface)", border: "1px solid var(--border-raw)",
                  color: "var(--text-2)", display: "inline-flex", alignItems: "center", gap: 7,
                }}
              >
                {f.kind === "lut" ? <Sparkles size={13} /> :
                  f.kind === "preset" ? <Paperclip size={13} /> :
                  <Paperclip size={13} />}
                {f.name}
                <button
                  onClick={() =>
                    removeAttachment({ type: "question", questionId: question.id }, f.id)
                  }
                  style={{
                    color: "var(--text-3)", display: "flex",
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                fontSize: 12, padding: "6px 11px", borderRadius: 8,
                border: "1.5px dashed var(--border-2)", color: "var(--text-2)",
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", cursor: "pointer",
              }}
            >
              {uploading ? <Loader2 className="animate-spin" size={13} /> : <Plus size={13} />}
              Attach
            </button>
            <input
              ref={fileRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <label className="eyebrow" style={{ display: "block", marginBottom: 9 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const editInput: React.CSSProperties = {
  width: "100%", padding: "11px 13px", fontSize: 14.5,
  borderRadius: "var(--r-md)",
  background: "var(--surface)", border: "1px solid var(--border-2)",
  color: "var(--text)", transition: "border-color .14s ease",
};

function RevealPicker({
  currentQuestionId,
  optionId,
  selected,
  onChange,
  label,
}: {
  currentQuestionId: string;
  optionId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const { questions } = useBuilder();
  const [open, setOpen] = React.useState(selected.length > 0);
  // Only candidates AFTER the current question — same-flow forward-reveal only.
  const currentIdx = questions.findIndex((q) => q.id === currentQuestionId);
  const candidates = questions.filter((q, i) => i > currentIdx && q.kind !== "message");
  const selectedSet = new Set(selected);

  function toggle(qid: string) {
    const next = new Set(selectedSet);
    if (next.has(qid)) next.delete(qid);
    else next.add(qid);
    onChange(Array.from(next));
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 8px", borderRadius: 99,
          background: selected.length > 0 ? "var(--accent-weak)" : "var(--bg-2)",
          color: selected.length > 0 ? "var(--accent-ink)" : "var(--text-2)",
          fontSize: 11, fontWeight: 500,
          border: "1px solid", borderColor: selected.length > 0 ? "var(--accent)" : "transparent",
          cursor: "pointer",
        }}
      >
        <Filter size={11} />
        {label ?? "If selected, also show…"}
        {selected.length > 0 && (
          <span className="mono" style={{ fontSize: 10 }}>
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-raw)",
            borderRadius: "var(--r-md)",
            display: "flex", flexWrap: "wrap", gap: 6,
          }}
        >
          {candidates.map((q, i) => {
            const isSel = selectedSet.has(q.id);
            return (
              <button
                key={q.id}
                onClick={() => toggle(q.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 99,
                  fontSize: 11.5, fontWeight: 500,
                  background: isSel ? "var(--accent)" : "var(--surface)",
                  color: isSel ? "var(--accent-contrast)" : "var(--text-2)",
                  border: "1px solid", borderColor: isSel ? "var(--accent)" : "var(--border-raw)",
                  boxShadow: isSel ? "var(--glow)" : "none",
                  cursor: "pointer",
                  maxWidth: 260,
                }}
              >
                <span className="mono" style={{ fontSize: 9.5, opacity: 0.7 }}>
                  {String(questions.indexOf(q) + 1).padStart(2, "0")}
                </span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {q.title || "Untitled"}
                </span>
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: "var(--text-3)", padding: "5px 4px" }}>
            Only later questions in the same brief can be revealed.
          </span>
        </div>
      )}
    </div>
  );
}

/** Display label for a media kind chip ("gif" is surfaced as "Animated"). */
function mediaKindLabel(kind: "image" | "gif" | "video" | "text"): string {
  return kind === "gif" ? "animated" : kind;
}

function mediaChip(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: "5px 10px", borderRadius: 7,
    textTransform: "uppercase", letterSpacing: ".05em",
    border: "1px solid",
    borderColor: active ? "var(--accent)" : "var(--border-raw)",
    background: active ? "var(--accent-weak)" : "transparent",
    color: active ? "var(--accent-ink)" : "var(--text-2)",
    fontWeight: 500, cursor: "pointer",
  };
}
