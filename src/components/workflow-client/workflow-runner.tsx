"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type {
  WorkflowSnapshotPayload,
  WorkflowAnswerValue,
  WorkflowNodeKind,
} from "@/lib/supabase/database.types";
import {
  QuestionSurface, ChoiceSurface, IdentitySurface, NoteSurface, PlacementSurface,
} from "./node-surfaces";
import { ANSWER_TYPE_ORDER } from "@/lib/workflow/node-theme";
import { getPlacement, hasPlacementAnswer } from "@/lib/workflow/placement";

type Snapshot = WorkflowSnapshotPayload;
type SnapNode = Snapshot["nodes"][number];
type SnapEdge = Snapshot["edges"][number];
type Draft = WorkflowAnswerValue & { commentText?: string };

/**
 * Walks the published graph one node per screen, following edges based on the
 * client's answers (branching). A node with no matching outgoing edge ends the
 * flow. Answers persist as the client advances; Back re-walks the visited path.
 */
export function WorkflowRunner({
  slug,
  snapshot,
  responseId,
  onDone,
}: {
  slug: string;
  snapshot: Snapshot;
  responseId: string;
  onDone: () => void;
}) {
  const nodeById = React.useMemo(
    () => new Map(snapshot.nodes.map((n) => [n.id, n])),
    [snapshot.nodes],
  );

  // Outgoing edge for a given (node, port), or null.
  const edgeFor = React.useCallback(
    (nodeId: string, port: string): SnapEdge | null =>
      snapshot.edges.find((e) => e.source_node_id === nodeId && e.source_port === port) ?? null,
    [snapshot.edges],
  );

  // The first real node = follow the Start node's single "out" edge. If the
  // graph has no Start (or it's unconnected), fall back to the first non-start
  // node so the client still sees something.
  const firstNodeId = React.useMemo(() => {
    const start = snapshot.nodes.find((n) => n.kind === "start");
    if (start) {
      const e = edgeFor(start.id, "out");
      if (e && nodeById.has(e.target_node_id)) return e.target_node_id;
    }
    return snapshot.nodes.find((n) => n.kind !== "start")?.id ?? null;
  }, [snapshot.nodes, edgeFor, nodeById]);

  const [history, setHistory] = React.useState<string[]>(() => (firstNodeId ? [firstNodeId] : []));
  const [answers, setAnswers] = React.useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const currentId = history[history.length - 1] ?? null;
  const node = currentId ? nodeById.get(currentId) ?? null : null;
  const draft = React.useMemo<Draft>(
    () => (currentId ? answers[currentId] ?? {} : {}),
    [currentId, answers],
  );

  const stepNo = history.length;

  const canAdvance = React.useMemo(() => {
    if (!node) return false;
    switch (node.kind) {
      case "note":
        return true;
      case "question": {
        // Any enabled channel with content satisfies it; if nothing is enabled
        // it's informational and always advanceable.
        const a = node.data.answer;
        const anyEnabled = a && (a.text || a.image || a.video || a.link || a.file);
        if (!anyEnabled) return true;
        return !!draft.text?.trim() || !!draft.link?.trim() || (draft.files?.length ?? 0) > 0;
      }
      case "choice":
      case "identity":
        return (draft.selected?.length ?? 0) > 0;
      case "placement": {
        // Optional placements can be skipped; required ones need the channel the
        // editor asked for (text / media / link) and — when there's more than
        // one option — a chosen option.
        if (!node.data.required) return true;
        const p = getPlacement(node.data);
        if (p.tabs.length > 1 && !(draft.selected?.length ?? 0)) return false;
        return hasPlacementAnswer(p.respond, draft);
      }
      default:
        return false;
    }
  }, [node, draft]);

  function patch(p: Partial<WorkflowAnswerValue & { commentText?: string }>) {
    if (!currentId) return;
    setAnswers((a) => ({ ...a, [currentId]: { ...a[currentId], ...p } }));
  }

  // Which output port the client's answer took (drives the next hop).
  const chosenPort = React.useCallback(
    (n: SnapNode, d: WorkflowAnswerValue): string | null => {
      switch (n.kind) {
        case "note":
        case "placement":
          return "out";
        case "question": {
          // Question ports are answer-type keys (text/image/video/link/file), or
          // a single "out" when no type is enabled. Route by the type the client
          // actually used, preferring a port that's wired; else the first wired
          // port so a single-branch question still advances.
          const used: string[] = [];
          if (d.text?.trim()) used.push("text");
          if (d.link?.trim()) used.push("link");
          if ((d.files?.length ?? 0) > 0) used.push("image", "video", "file");
          for (const p of used) if (edgeFor(n.id, p)) return p;
          // Fall back to the first enabled-type port that's wired (or "out").
          const enabled = ANSWER_TYPE_ORDER.filter((k) => n.data.answer?.[k]);
          const candidates = enabled.length ? enabled : ["out"];
          const firstWired = candidates.find((p) => edgeFor(n.id, p));
          return firstWired ?? used[0] ?? candidates[0] ?? "out";
        }
        case "choice":
        case "identity": {
          // First selected option that actually has an outgoing edge (multi-branch rule).
          for (const id of d.selected ?? []) {
            if (edgeFor(n.id, id)) return id;
          }
          // No selected option is wired → treat the first selection as the port
          // (dead-end → finish), falling back to none.
          return (d.selected ?? [])[0] ?? null;
        }
        default:
          return null;
      }
    },
    [edgeFor],
  );

  async function persist(n: SnapNode, d: WorkflowAnswerValue & { commentText?: string }) {
    const value: WorkflowAnswerValue =
      n.kind === "question"
        ? { text: d.text, link: d.link, files: d.files }
        : n.kind === "placement"
          ? {
              text: d.text,
              link: d.link,
              files: d.files,
              // Which option they landed on — defaults to the only one when the
              // node has a single tab and nothing was explicitly picked.
              selected: d.selected?.length ? d.selected : [getPlacement(n.data).tabs[0]?.id].filter(Boolean) as string[],
            }
          : n.kind === "choice" || n.kind === "identity"
            ? { selected: d.selected ?? [] }
            : {};
    await fetch(`/api/w/${slug}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        responseId,
        nodeId: n.id,
        kind: n.kind as WorkflowNodeKind,
        value,
        commentText: d.commentText ?? null,
      }),
    }).catch(() => {/* best-effort; submit still records the path */});
  }

  async function finish(finalPath: string[]) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/w/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseId, path: finalPath }),
      });
      if (!res.ok) throw new Error("Submit failed");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
      setSubmitting(false);
    }
  }

  async function next() {
    if (!node || !currentId) return;
    await persist(node, draft);

    const port = chosenPort(node, draft);
    const edge = port ? edgeFor(currentId, port) : null;
    const nextId = edge && nodeById.has(edge.target_node_id) ? edge.target_node_id : null;

    if (!nextId) {
      // Dead end → finish & submit with the path we've walked.
      await finish(history);
      return;
    }
    setTick((x) => x + 1);
    setHistory((h) => [...h, nextId]);
  }

  function back() {
    if (history.length <= 1) return;
    setTick((x) => x + 1);
    setHistory((h) => h.slice(0, -1));
  }

  // Is the current node terminal (no wired outgoing edge for the chosen answer)?
  const isTerminal = React.useMemo(() => {
    if (!node || !currentId) return false;
    const port = chosenPort(node, draft);
    return !(port && edgeFor(currentId, port));
  }, [node, currentId, draft, edgeFor, chosenPort]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && canAdvance && !submitting) next();
      else if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, canAdvance, submitting, draft]);

  if (!node) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Nothing to answer yet</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-2)" }}>
            This workflow doesn&apos;t have any connected questions.
          </p>
        </div>
      </div>
    );
  }

  const nextLabel = isTerminal ? "Finish" : "Next";

  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column", position: "relative",
        padding: "50px 50px 110px", minHeight: 0,
      }}
    >
      <SideArrow side="left" disabled={history.length <= 1} onClick={back} label="Back" />
      <SideArrow
        side="right"
        disabled={!canAdvance || submitting}
        onClick={next}
        label={nextLabel}
        primary={isTerminal}
        loading={submitting}
      />

      {/* Step indicator */}
      <div
        style={{
          position: "absolute", insetBlockStart: 24, insetInlineStart: 50,
          fontSize: 11, letterSpacing: ".08em", color: "var(--text-3)", textTransform: "uppercase",
        }}
        dir="ltr"
      >
        Step {stepNo}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${node.id}-${tick}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, alignItems: "center", justifyContent: "center", width: "100%" }}
        >
          {node.kind === "question" && (
            <QuestionSurface slug={slug} node={node} draft={draft} onPatch={patch} onSubmit={next} canAdvance={canAdvance} submitting={submitting} isTerminal={isTerminal} />
          )}
          {node.kind === "choice" && (
            <ChoiceSurface node={node} draft={draft} onPatch={patch} />
          )}
          {node.kind === "identity" && (
            <IdentitySurface node={node} draft={draft} onPatch={patch} />
          )}
          {node.kind === "placement" && (
            <PlacementSurface slug={slug} node={node} draft={draft} onPatch={patch} onSubmit={next} canAdvance={canAdvance} submitting={submitting} isTerminal={isTerminal} />
          )}
          {node.kind === "note" && <NoteSurface node={node} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SideArrow({
  side, disabled, onClick, label, primary, loading,
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
        position: "absolute", insetBlockStart: "50%",
        [side === "left" ? "insetInlineStart" : "insetInlineEnd"]: 14,
        transform: "translateY(-50%)",
        width: 44, height: 44, borderRadius: 99,
        background: primary && !disabled ? "var(--accent)" : "var(--surface)",
        color: primary && !disabled ? "var(--accent-contrast)" : disabled ? "var(--text-3)" : "var(--text-2)",
        border: "1px solid", borderColor: primary && !disabled ? "transparent" : "var(--border-raw)",
        boxShadow: primary && !disabled ? "var(--glow)" : "var(--shadow-sm)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        zIndex: 10, transition: "all .15s ease",
      } as React.CSSProperties}
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : <ArrowIcon size={18} />}
    </button>
  );
}
