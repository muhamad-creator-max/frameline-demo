"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Check, Paperclip, Link2, Layers, Download, ExternalLink, Inbox,
} from "lucide-react";
import type {
  WorkflowSnapshotPayload, WorkflowAnswerValue, WorkflowNodeKind, SettingCell, Attachment,
} from "@/lib/supabase/database.types";
import { activeTab, getPlacement, RESPOND_LABEL } from "@/lib/workflow/placement";
import { PlacementStage } from "./placement-stage";

type SnapNode = WorkflowSnapshotPayload["nodes"][number];

interface AnswerRow {
  id: string;
  node_id: string;
  kind: WorkflowNodeKind;
  value: WorkflowAnswerValue;
  comment_text: string | null;
}
interface ResponseRow {
  id: string;
  client_name: string;
  status: "in_progress" | "submitted";
  started_at: string;
  submitted_at: string | null;
  duration_ms: number | null;
  path: string[];
  snapshot: WorkflowSnapshotPayload | null;
  answers: AnswerRow[];
}

export function WorkflowResponsesClient({
  projectId, title, rows,
}: {
  projectId: string;
  title: string;
  rows: ResponseRow[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(rows[0]?.id ?? null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      <header
        style={{
          height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          padding: "0 16px", borderBottom: "1px solid var(--border-raw)", background: "var(--bg)",
        }}
      >
        <Link href={`/app/workflows/${projectId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-2)", textDecoration: "none", padding: "6px 8px", borderRadius: 7 }}>
          <ArrowLeft size={15} /> Editor
        </Link>
        <span className="display-title" style={{ ["--display-title-size" as string]: "13px" }}>{title} · Responses</span>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{rows.length} total</span>
      </header>

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 340 }}>
            <div style={{ display: "inline-flex", width: 44, height: 44, borderRadius: 12, background: "var(--accent-weak)", color: "var(--accent-ink)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Inbox size={22} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No responses yet</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>
              Publish the workflow and share its link — client answers will show up here.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* List */}
          <aside style={{ width: 260, flexShrink: 0, borderInlineEnd: "1px solid var(--border-raw)", overflowY: "auto", background: "var(--bg-2)" }}>
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left",
                  padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border-raw)",
                  background: selectedId === r.id ? "var(--surface)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{r.client_name}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {r.status === "submitted" ? formatDate(r.submitted_at) : "In progress"} · {r.answers.length} answers
                </span>
              </button>
            ))}
          </aside>

          {/* Detail */}
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            {selected && <ResponseDetail response={selected} />}
          </main>
        </div>
      )}
    </div>
  );
}

function ResponseDetail({ response }: { response: ResponseRow }) {
  const nodeById = React.useMemo(
    () => new Map((response.snapshot?.nodes ?? []).map((n) => [n.id, n])),
    [response.snapshot],
  );

  // Answers in the order the client actually walked them, when we have a path.
  const orderedAnswers = React.useMemo(() => {
    const path = response.path ?? [];
    if (path.length) {
      const byNode = new Map(response.answers.map((a) => [a.node_id, a]));
      const ordered = path.map((nid) => byNode.get(nid)).filter(Boolean) as AnswerRow[];
      // Append any answers not in path (shouldn't happen, but safe).
      const extra = response.answers.filter((a) => !path.includes(a.node_id));
      return [...ordered, ...extra];
    }
    return response.answers;
  }, [response]);

  function copyText() {
    const lines: string[] = [`Response from ${response.client_name}`, ""];
    for (const a of orderedAnswers) {
      const node = nodeById.get(a.node_id) ?? null;
      lines.push(`Q: ${nodeTitle(node, a.kind)}`);
      lines.push(`A: ${answerToText(a, node)}`);
      const cells = (node?.data.settings ?? []).filter((c) => c.label || c.value);
      if (cells.length) lines.push(`Editor: ${cells.map((c) => `${c.label}=${c.value}`).join(", ")}`);
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Response copied");
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 28px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>{response.client_name}</h1>
          <p style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>
            {response.status === "submitted"
              ? `Submitted ${formatDate(response.submitted_at)}${response.duration_ms ? ` · took ${Math.round(response.duration_ms / 1000)}s` : ""}`
              : "In progress"}
          </p>
        </div>
        <button
          onClick={copyText}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border-raw)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}
        >
          <Copy size={14} /> Copy for editor
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {orderedAnswers.map((a, i) => (
          <AnswerCard key={a.id} index={i} answer={a} node={nodeById.get(a.node_id) ?? null} />
        ))}
        {orderedAnswers.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>No answers recorded.</p>
        )}
      </div>
    </div>
  );
}

function AnswerCard({ index, answer, node }: { index: number; answer: AnswerRow; node: SnapNode | null }) {
  return (
    <div style={{ border: "1px solid var(--border-raw)", borderRadius: 12, background: "var(--surface)", padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3)", marginBottom: 6 }}>
        {index + 1} · {answer.kind}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{nodeTitle(node, answer.kind)}</div>

      <AnswerBody answer={answer} node={node} />

      <EditorHandoff settings={node?.data.settings} attachments={node?.data.attachments} />
    </div>
  );
}

function AnswerBody({ answer, node }: { answer: AnswerRow; node: SnapNode | null }) {
  if (answer.kind === "choice" || answer.kind === "identity") {
    const labels = (answer.value.selected ?? []).map((id) => selectionLabel(node, answer.kind, id));
    if (labels.length === 0) return <Muted>No selection</Muted>;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "5px 10px", borderRadius: 99, background: "var(--accent-weak)", color: "var(--accent-ink)", fontWeight: 500 }}>
            <Check size={12} /> {l}
          </span>
        ))}
      </div>
    );
  }

  if (answer.kind === "question" || answer.kind === "placement") {
    const { text, link, files } = answer.value;
    const hasAny = text?.trim() || link?.trim() || (files?.length ?? 0) > 0;
    // Placement answers only make sense next to what the client was shown, so
    // re-render the exact composite they picked, straight from the snapshot.
    const stage = answer.kind === "placement" && node ? <PickedPlacement answer={answer} node={node} /> : null;
    if (!hasAny) return <>{stage}<Muted>No answer</Muted></>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stage}
        {text?.trim() && <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>{text}</p>}
        {link?.trim() && (
          <a href={link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent-ink)", textDecoration: "none", wordBreak: "break-all" }}>
            <Link2 size={14} /> {link} <ExternalLink size={12} />
          </a>
        )}
        {(files ?? []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {files!.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border-raw)", color: "var(--text-2)", textDecoration: "none" }}>
                <Paperclip size={13} /> {f.name} <Download size={12} />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // note
  return <Muted>Acknowledged</Muted>;
}

/** The placement option the client chose, rendered exactly as they saw it. */
function PickedPlacement({ answer, node }: { answer: AnswerRow; node: SnapNode }) {
  const placement = getPlacement(node.data);
  const picked = activeTab(placement, answer.value.selected?.[0] ?? null);
  const index = placement.tabs.findIndex((t) => t.id === picked.id);
  return (
    <div style={{ maxWidth: 420, marginBottom: 12 }}>
      {placement.tabs.length > 1 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "5px 10px", borderRadius: 99, background: "var(--accent-weak)", color: "var(--accent-ink)", fontWeight: 500, marginBottom: 8 }}>
          <Check size={12} /> Picked {picked.name || `Option ${index + 1}`}
          <span style={{ color: "var(--text-3)", fontWeight: 400 }}>of {placement.tabs.length}</span>
        </div>
      )}
      <PlacementStage tab={picked} aspect={placement.aspect} radius={10} emptyHint="No media" />
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
        Asked for: {RESPOND_LABEL[placement.respond]}
      </div>
    </div>
  );
}

function EditorHandoff({ settings, attachments }: { settings?: SettingCell[]; attachments?: Attachment[] }) {
  const cells = (settings ?? []).filter((c) => c.label || c.value);
  const files = attachments ?? [];
  if (cells.length === 0 && files.length === 0) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Layers size={13} style={{ color: "var(--text-3)" }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3)" }}>Editor hand-off</span>
      </div>
      {cells.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {cells.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
              <span className="mono" style={{ color: "var(--text-2)", textTransform: "uppercase", fontSize: 11 }}>{c.label}</span>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.value || "—"}</span>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: cells.length ? 10 : 0 }}>
          {files.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, padding: "5px 9px", borderRadius: 7, background: "var(--surface-2)", border: "1px solid var(--border-raw)", color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>{children}</p>;
}

// ─────────────────────────── helpers ───────────────────────────
function nodeTitle(node: SnapNode | null, kind: WorkflowNodeKind): string {
  if (!node) return "(question removed)";
  if (kind === "note") return node.data.text?.slice(0, 80) || "Note";
  if (kind === "placement") return node.data.title?.trim() || "Placement preview";
  return node.data.title?.trim() || "Untitled question";
}

function selectionLabel(node: SnapNode | null, kind: WorkflowNodeKind, id: string): string {
  if (!node) return id;
  if (kind === "choice") return node.data.choices?.find((c) => c.id === id)?.label || "Choice";
  if (kind === "identity") {
    const b = node.data.boxes?.find((x) => x.id === id);
    return b?.text || "Box";
  }
  return id;
}

function answerToText(a: AnswerRow, node: SnapNode | null): string {
  if (a.kind === "choice" || a.kind === "identity") {
    return (a.value.selected ?? []).map((id) => selectionLabel(node, a.kind, id)).join(", ") || "—";
  }
  if (a.kind === "question" || a.kind === "placement") {
    const parts: string[] = [];
    if (a.kind === "placement" && node && a.value.selected?.length) {
      const p = getPlacement(node.data);
      const picked = p.tabs.find((t) => t.id === a.value.selected?.[0]);
      if (picked && p.tabs.length > 1) parts.push(`Picked: ${picked.name}`);
    }
    if (a.value.text?.trim()) parts.push(a.value.text.trim());
    if (a.value.link?.trim()) parts.push(a.value.link.trim());
    if (a.value.files?.length) parts.push(a.value.files.map((f) => f.url).join(", "));
    return parts.join(" | ") || "—";
  }
  return "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
