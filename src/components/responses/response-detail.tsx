"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User, Layers, Check, ThumbsUp, ThumbsDown, MessageSquare,
  Paperclip, Sparkles, Copy, Download, X, ChevronLeft, ChevronRight, ArrowLeft,
} from "lucide-react";
import type { GuidelineSnapshotPayload, Attachment, SettingCell } from "@/lib/supabase/database.types";

interface Answer {
  question_id: string;
  selected_option_ids: string[] | null;
  liked: boolean | null;
  text_value: string | null;
  comment_text: string | null;
  comment_attachments: Attachment[];
}

interface Sibling {
  id: string;
  client_name: string;
  status: "in_progress" | "submitted";
  submitted: string;
  done: boolean;
}

export function ResponseDetail({
  guideline,
  response,
  siblings,
  snapshot,
  answers,
}: {
  guideline: { id: string; title: string };
  response: { id: string; client_name: string; status: "in_progress" | "submitted"; submitted: string };
  siblings: Sibling[];
  snapshot: GuidelineSnapshotPayload;
  answers: Answer[];
}) {
  const router = useRouter();
  const [showHandoff, setShowHandoff] = React.useState(false);
  const [focusedIdx, setFocusedIdx] = React.useState<number | null>(null);
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  const answerableQs = snapshot.questions.filter((q) => q.kind !== "message");

  React.useEffect(() => {
    if (focusedIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusedIdx(null);
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setFocusedIdx((v) => (v != null && v < answerableQs.length - 1 ? v + 1 : v));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setFocusedIdx((v) => (v != null && v > 0 ? v - 1 : v));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedIdx, answerableQs.length]);

  function copyForEditor(qIdx: number) {
    const q = snapshot.questions[qIdx];
    if (!q) return;
    const chosen = answerMap.get(q.id)?.selected_option_ids ?? [];
    const optionSettings = q.options
      .filter((o) => chosen.includes(o.id))
      .flatMap((o) => o.settings);
    const cells = [...optionSettings, ...q.settings];
    const lines = [
      `${q.title}`,
      ...cells.map((c) => `${c.label}: ${c.value}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Recipe copied for editor");
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Respondent list */}
      <aside
        style={{
          width: 280, flexShrink: 0,
          borderInlineEnd: "1px solid var(--border-raw)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 18px 12px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {siblings.length} {siblings.length === 1 ? "response" : "responses"}
          </div>
          <h3 style={{ fontSize: 15, lineHeight: 1.3 }}>{guideline.title}</h3>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {siblings.map((s) => {
            const selected = s.id === response.id;
            const initials = s.client_name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/app/responses/${s.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, borderRadius: "var(--r-md)", textAlign: "start",
                  border: "1px solid",
                  background: selected ? "var(--surface)" : "transparent",
                  borderColor: selected ? "var(--border-2)" : "transparent",
                  boxShadow: selected ? "var(--shadow-sm)" : "none",
                  cursor: "pointer", transition: "all .14s ease",
                }}
              >
                <span
                  style={{
                    width: 38, height: 38, borderRadius: 99,
                    background: "var(--bg-2)", color: "var(--text-2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 14, flexShrink: 0,
                  }}
                >
                  {initials || "?"}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
                    {s.client_name}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{s.submitted}</span>
                </span>
                {s.done && (
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", boxShadow: "var(--glow)" }} />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Detail */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 30px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={() => router.push("/app/responses")}
                title="Back to responses"
                style={{
                  width: 34, height: 34, borderRadius: "var(--r-md)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--surface)", border: "1px solid var(--border-raw)",
                  color: "var(--text-2)", cursor: "pointer",
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <span
                style={{
                  width: 46, height: 46, borderRadius: 99,
                  background: "var(--accent-weak)", color: "var(--accent-ink)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                }}
              >
                {response.client_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </span>
              <div>
                <h2 style={{ fontSize: 20 }}>{response.client_name}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  Client · {response.submitted}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex", gap: 4,
                background: "var(--bg-2)", padding: 3, borderRadius: 99,
              }}
            >
              <SegBtn active={!showHandoff} onClick={() => setShowHandoff(false)} icon={<User size={14} />}>
                Client answers
              </SegBtn>
              <SegBtn active={showHandoff} onClick={() => setShowHandoff(true)} icon={<Layers size={14} />}>
                Editor handoff
              </SegBtn>
            </div>
          </div>

          {/* Blocks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {snapshot.questions.map((q, i) => {
              const answerableIdx = answerableQs.findIndex((x) => x.id === q.id);
              return (
                <AnswerBlock
                  key={q.id}
                  q={q}
                  idx={i}
                  answer={answerMap.get(q.id)}
                  showHandoff={showHandoff}
                  onCopyRecipe={() => copyForEditor(i)}
                  onFocus={answerableIdx >= 0 ? () => setFocusedIdx(answerableIdx) : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Full-view overlay */}
      {focusedIdx !== null && (() => {
        const q = answerableQs[focusedIdx];
        const answer = q ? answerMap.get(q.id) : undefined;
        const qIdx = snapshot.questions.findIndex((x) => x.id === q?.id);
        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)",
              display: "flex", flexDirection: "column",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setFocusedIdx(null); }}
          >
            {/* Top bar */}
            <div
              style={{
                height: 56, flexShrink: 0,
                padding: "0 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>
                <span className="mono" style={{ marginRight: 8, opacity: 0.5 }}>{String(focusedIdx + 1).padStart(2, "0")}/{answerableQs.length}</span>
                {q?.title}
              </span>
              <button
                onClick={() => setFocusedIdx(null)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,.08)", border: "none", color: "#fff", cursor: "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 80px" }}>
              <div style={{ width: "100%", maxWidth: 680 }}>
                {q && (
                  <AnswerBlock
                    q={q}
                    idx={qIdx}
                    answer={answer}
                    showHandoff={showHandoff}
                    onCopyRecipe={() => qIdx >= 0 && copyForEditor(qIdx)}
                    fullView
                  />
                )}
              </div>
            </div>

            {/* Nav arrows */}
            {focusedIdx > 0 && (
              <button
                onClick={() => setFocusedIdx((v) => (v != null ? v - 1 : v))}
                style={{
                  position: "fixed", left: 20, top: "50%", transform: "translateY(-50%)",
                  width: 44, height: 44, borderRadius: 99,
                  background: "rgba(255,255,255,.12)", border: "none", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {focusedIdx < answerableQs.length - 1 && (
              <button
                onClick={() => setFocusedIdx((v) => (v != null ? v + 1 : v))}
                style={{
                  position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)",
                  width: 44, height: 44, borderRadius: 99,
                  background: "rgba(255,255,255,.12)", border: "none", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function AnswerBlock({
  q,
  idx,
  answer,
  showHandoff,
  onCopyRecipe,
  onFocus,
  fullView,
}: {
  q: GuidelineSnapshotPayload["questions"][number];
  idx: number;
  answer?: Answer;
  showHandoff: boolean;
  onCopyRecipe: () => void;
  onFocus?: () => void;
  fullView?: boolean;
}) {
  const chosenIds = new Set(answer?.selected_option_ids ?? []);
  const optionSettings = q.options.filter((o) => chosenIds.has(o.id)).flatMap((o) => o.settings);
  const optionAttachments = q.options.filter((o) => chosenIds.has(o.id)).flatMap((o) => o.attachments);
  const cells: SettingCell[] = [...optionSettings, ...q.settings];
  const files: Attachment[] = [...optionAttachments, ...q.attachments];
  const handoffEnabled = cells.length > 0 || files.length > 0;

  return (
    <div
      onClick={onFocus}
      style={{
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: "var(--surface)",
        cursor: onFocus ? "pointer" : "default",
        transition: "border-color .15s ease",
      }}
      onMouseEnter={(e) => { if (onFocus) e.currentTarget.style.borderColor = "var(--border-2)"; }}
      onMouseLeave={(e) => { if (onFocus) e.currentTarget.style.borderColor = "var(--border-raw)"; }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {/* Asked */}
        <div style={{ padding: "20px 22px", borderInlineEnd: "1px solid var(--border-raw)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
                padding: "3px 8px", borderRadius: 99,
                background: "var(--bg-2)", color: "var(--text-2)",
              }}
            >
              {q.kind === "answer" ? "open" : q.kind}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            {q.title}
          </div>
          {q.kind === "choice" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {q.options.map((o) => (
                <span key={o.id} className="muted" style={{ fontSize: 12.5 }}>
                  · {o.label || "Option"}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Answered */}
        <div style={{ padding: "20px 22px", background: "var(--surface-2)" }}>
          <div className="eyebrow" style={{ marginBottom: 12, color: "var(--accent-ink)" }}>
            Their answer
          </div>
          <AnswerView q={q} answer={answer} />
          {answer?.comment_text && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--border-raw)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)", marginBottom: 6 }}>
                <MessageSquare size={13} />
                <span
                  className="mono"
                  style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase" }}
                >
                  Note
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{answer.comment_text}</div>
            </div>
          )}
          {answer?.comment_attachments && answer.comment_attachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {answer.comment_attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{
                    fontSize: 11, padding: "4px 9px", borderRadius: 99,
                    background: "var(--surface)", border: "1px solid var(--border-raw)",
                    color: "var(--text-2)", textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Paperclip size={11} />
                  {a.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Handoff recipe */}
      {showHandoff && (
        handoffEnabled ? (
          <div
            className="fade-only"
            style={{
              borderTop: "1px solid var(--accent)",
              background: "var(--accent-weak)",
              padding: "18px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent-ink)" }}>
                <Layers size={15} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>How to recreate this look</span>
              </div>
              <button
                onClick={onCopyRecipe}
                className="mono"
                style={{
                  fontSize: 11, color: "var(--accent-ink)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 99,
                  border: "1px solid var(--accent)",
                  background: "transparent", cursor: "pointer",
                }}
              >
                <Copy size={12} /> Copy for editor
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              {cells.map((c, i) => (
                <div
                  key={c.id ?? i}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-raw)",
                    borderRadius: "var(--r-md)",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase",
                      color: "var(--text-3)", marginBottom: 4,
                    }}
                  >
                    {c.label}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.value}</div>
                </div>
              ))}
            </div>
            {files.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                    style={{
                      fontSize: 11.5, padding: "7px 11px", borderRadius: 8,
                      background: "var(--surface)", border: "1px solid var(--border-raw)",
                      color: "var(--text)", textDecoration: "none",
                      display: "inline-flex", alignItems: "center", gap: 8,
                    }}
                  >
                    {f.kind === "lut" ? <Sparkles size={13} style={{ color: "var(--accent)" }} /> :
                      <Paperclip size={13} style={{ color: "var(--accent)" }} />}
                    {f.name}
                    <Download size={12} style={{ color: "var(--text-3)" }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="fade-only"
            style={{
              borderTop: "1px solid var(--border-raw)",
              padding: "14px 22px",
              color: "var(--text-3)", fontSize: 12.5,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Layers size={14} /> No handoff recipe added for this question.
          </div>
        )
      )}
    </div>
  );
}

function AnswerView({
  q,
  answer,
}: {
  q: GuidelineSnapshotPayload["questions"][number];
  answer?: Answer;
}) {
  if (!answer) {
    return <span className="faint" style={{ fontSize: 13.5 }}>No answer.</span>;
  }
  if (q.kind === "answer") {
    if (!answer.text_value && !answer.comment_text) {
      return <span className="faint" style={{ fontSize: 13.5 }}>No answer.</span>;
    }
    return (
      <div style={{ fontSize: 16, lineHeight: 1.5, fontStyle: "italic", color: "var(--text)" }}>
        “{answer.text_value || answer.comment_text}”
      </div>
    );
  }
  if (q.kind === "like") {
    if (answer.liked == null) return <span className="faint" style={{ fontSize: 13.5 }}>Skipped.</span>;
    const yes = answer.liked === true;
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          color: yes ? "var(--accent-ink)" : "var(--danger)",
          fontWeight: 600, fontSize: 16,
        }}
      >
        <span
          style={{
            width: 40, height: 40, borderRadius: 99,
            background: yes ? "var(--accent-weak)" : "rgba(229,72,77,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {yes ? <ThumbsUp size={20} /> : <ThumbsDown size={20} />}
        </span>
        {yes ? "I like it" : "Not for me"}
      </div>
    );
  }
  // choice
  const picked = q.options.filter((o) => (answer.selected_option_ids ?? []).includes(o.id));
  if (picked.length === 0) {
    return <span className="faint" style={{ fontSize: 13.5 }}>No choice made.</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {picked.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {o.media_kind !== "text" && o.media_url && (
            <div style={{ width: 56, height: 42, borderRadius: 7, flexShrink: 0, overflow: "hidden", background: "var(--bg-2)", position: "relative" }}>
              {o.media_provider === "mux" ? (
                <span className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text-3)", fontSize: 9, textTransform: "uppercase" }}>video</span>
              ) : o.media_kind === "gif" && /\.(webm|mp4|mov|m4v)($|\?)/i.test(o.media_url) ? (
                <video src={o.media_url} muted loop autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Image src={o.media_url} alt="" fill style={{ objectFit: "cover" }} unoptimized sizes="56px" />
              )}
            </div>
          )}
          <span style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>{o.label || "Option"}</span>
          </span>
          <span
            style={{
              width: 22, height: 22, borderRadius: 99,
              background: "var(--accent)", color: "var(--accent-contrast)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Check size={13} strokeWidth={2.6} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontSize: 12.5, fontWeight: 550,
        padding: "7px 13px", borderRadius: 99,
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        border: "none", cursor: "pointer",
        transition: "all .14s ease",
      }}
    >
      {icon} {children}
    </button>
  );
}
