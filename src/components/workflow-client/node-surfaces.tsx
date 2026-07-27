"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Check, Type as TypeIcon, Loader2 } from "lucide-react";
import type {
  WorkflowSnapshotPayload,
  WorkflowAnswerValue,
  WorkflowChoice,
  IdentityBox,
} from "@/lib/supabase/database.types";
import { ensureFontLoaded } from "@/lib/workflow/google-fonts";
import { activeTab, getPlacement, respondAnswerConfig, RESPOND_HINT } from "@/lib/workflow/placement";
import { PlacementStage } from "@/components/workflow/placement-stage";
import { WorkflowAnswerComposer } from "./workflow-answer-composer";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });

type SnapNode = WorkflowSnapshotPayload["nodes"][number];
type Draft = WorkflowAnswerValue & { commentText?: string };

// ─────────────────────────── shared header ───────────────────────────
function NodeHeader({ title, helper, big }: { title?: string; helper?: string; big?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, maxWidth: 640 }}>
      <h1 style={{ fontSize: big ? 28 : 22, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
        {title || "Untitled question"}
      </h1>
      {helper && <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55, maxWidth: 480 }}>{helper}</p>}
    </div>
  );
}

// ─────────────────────────── Question ───────────────────────────
export function QuestionSurface({
  slug, node, draft, onPatch, onSubmit, canAdvance, submitting, isTerminal,
}: {
  slug: string;
  node: SnapNode;
  draft: Draft;
  onPatch: (p: Partial<Draft>) => void;
  onSubmit: () => void;
  canAdvance: boolean;
  submitting: boolean;
  isTerminal: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
      <NodeHeader title={node.data.title} helper={node.data.helper} />
      <WorkflowAnswerComposer
        slug={slug}
        answer={node.data.answer}
        text={draft.text ?? ""}
        link={draft.link ?? ""}
        files={draft.files ?? []}
        onChange={onPatch}
        onSubmit={onSubmit}
        submitDisabled={!canAdvance || submitting}
        submitting={submitting}
        isTerminal={isTerminal}
      />
    </div>
  );
}

// ─────────────────────────── Choice ───────────────────────────
export function ChoiceSurface({
  node, draft, onPatch,
}: {
  node: SnapNode;
  draft: Draft;
  onPatch: (p: Partial<Draft>) => void;
}) {
  const choices = node.data.choices ?? [];
  const max = Math.max(1, node.data.max_answers ?? 1);
  const selected = new Set(draft.selected ?? []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (max === 1) {
        next.clear();
      } else if (next.size >= max) {
        // At the cap: ignore extra picks (client must deselect first).
        return;
      }
      next.add(id);
    }
    onPatch({ selected: [...next] });
  }

  const cols = Math.min(choices.length, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
      <NodeHeader title={node.data.title} helper={max > 1 ? `Pick up to ${max}` : undefined} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols || 1}, minmax(0, 1fr))`,
          gap: 14, width: "100%",
          maxWidth: cols >= 4 ? 980 : cols === 3 ? 760 : cols === 2 ? 560 : 340,
        }}
      >
        {choices.map((c) => (
          <ChoiceCard key={c.id} choice={c} selected={selected.has(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
    </div>
  );
}

function ChoiceCard({ choice, selected, onClick }: { choice: WorkflowChoice; selected: boolean; onClick: () => void }) {
  const isText = choice.media_kind === "text" || !choice.media_url;
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative", textAlign: "start", padding: 0, cursor: "pointer",
        borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface)",
        border: "2px solid", borderColor: selected ? "var(--accent)" : "var(--border-raw)",
        boxShadow: selected
          ? "var(--glow), 0 18px 50px -12px rgba(16,24,40,.18)"
          : "0 12px 40px -14px rgba(16,24,40,.14)",
        transition: "all .18s ease", transform: selected ? "translateY(-2px)" : "none",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: 8, insetInlineEnd: 8, zIndex: 2, width: 22, height: 22, borderRadius: 99, background: "var(--accent)", color: "var(--accent-contrast)", display: "grid", placeItems: "center", boxShadow: "var(--glow)" }}>
          <Check size={12} strokeWidth={3} />
        </div>
      )}
      {isText ? (
        <div style={{ padding: "22px 18px", minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", textAlign: "center" }}>{choice.label || "Option"}</div>
        </div>
      ) : (
        <>
          <ChoiceMedia choice={choice} />
          {choice.label && (
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-raw)" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{choice.label}</div>
            </div>
          )}
        </>
      )}
    </button>
  );
}

function ChoiceMedia({ choice }: { choice: WorkflowChoice }) {
  if (!choice.media_url) {
    return (
      <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--bg-2)", color: "var(--text-3)", display: "grid", placeItems: "center" }}>
        <TypeIcon size={20} />
      </div>
    );
  }
  if (choice.media_kind === "video" && choice.media_provider === "mux") {
    const isPending = choice.media_url.length > 40;
    if (isPending) {
      return (
        <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", color: "rgba(255,255,255,.7)", display: "grid", placeItems: "center" }}>
          <Loader2 className="animate-spin" size={18} />
        </div>
      );
    }
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", overflow: "hidden" }}>
        <MuxPlayer playbackId={choice.media_url} streamType="on-demand" accentColor="#00BE43" style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }
  const isLoopingVideo = /\.(webm|mp4|mov|m4v)($|\?)/i.test(choice.media_url);
  if (isLoopingVideo) {
    return (
      <div style={{ width: "100%", background: "var(--bg-2)", lineHeight: 0 }}>
        <video src={choice.media_url} muted loop autoPlay playsInline style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
    );
  }
  return (
    <div style={{ width: "100%", background: "var(--bg-2)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={choice.media_url} alt={choice.label ?? ""} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}

// ─────────────────────────── Identity ───────────────────────────
export function IdentitySurface({
  node, draft, onPatch,
}: {
  node: SnapNode;
  draft: Draft;
  onPatch: (p: Partial<Draft>) => void;
}) {
  const boxes = node.data.boxes ?? [];
  const max = Math.max(1, node.data.max_answers ?? 1);
  const selected = new Set(draft.selected ?? []);

  const fontKey = boxes.map((b) => b.font).join("|");
  React.useEffect(() => {
    for (const family of fontKey.split("|")) ensureFontLoaded(family);
  }, [fontKey]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else {
      if (max === 1) next.clear();
      else if (next.size >= max) return;
      next.add(id);
    }
    onPatch({ selected: [...next] });
  }

  const cols = Math.min(boxes.length, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
      <NodeHeader title={node.data.title || "Pick a direction"} helper={max > 1 ? `Pick up to ${max}` : undefined} />
      <div
        style={{
          display: "grid", gridTemplateColumns: `repeat(${cols || 1}, minmax(0, 1fr))`, gap: 16,
          width: "100%", maxWidth: cols >= 3 ? 760 : cols === 2 ? 540 : 320,
        }}
      >
        {boxes.map((b) => (
          <IdentityChoice key={b.id} box={b} selected={selected.has(b.id)} onClick={() => toggle(b.id)} />
        ))}
      </div>
    </div>
  );
}

function IdentityChoice({ box, selected, onClick }: { box: IdentityBox; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative", padding: 0, cursor: "pointer", border: "3px solid",
        borderColor: selected ? "var(--accent)" : "transparent", borderRadius: box.radius + 4,
        background: "transparent", transition: "all .16s ease", transform: selected ? "translateY(-2px)" : "none",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: 8, insetInlineEnd: 8, zIndex: 2, width: 22, height: 22, borderRadius: 99, background: "var(--accent)", color: "var(--accent-contrast)", display: "grid", placeItems: "center", boxShadow: "var(--glow)" }}>
          <Check size={12} strokeWidth={3} />
        </div>
      )}
      <div
        style={{
          height: 130, display: "grid", placeItems: "center",
          background: box.bg, borderRadius: box.radius,
          boxShadow: box.shadow && box.shadow !== "none" ? box.shadow : undefined,
        }}
      >
        <span
          style={{
            fontFamily: `"${box.font}", system-ui, sans-serif`, color: box.color,
            background: box.textBg && box.textBg !== "transparent" ? box.textBg : undefined,
            padding: box.textBg && box.textBg !== "transparent" ? "4px 12px" : undefined,
            borderRadius: 8, fontSize: 26, fontWeight: 600, lineHeight: 1.1,
            maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {box.text || "Aa"}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────── Placement ───────────────────────────
/**
 * Placement screen: the options are tabs. The client switches between them to
 * compare, and the tab they're on IS their pick (recorded in `selected`), so
 * choosing and viewing are the same gesture. With a single option there's
 * nothing to choose, so the strip is hidden and the pick is implicit.
 */
export function PlacementSurface({
  slug, node, draft, onPatch, onSubmit, canAdvance, submitting, isTerminal,
}: {
  slug: string;
  node: SnapNode;
  draft: Draft;
  onPatch: (p: Partial<Draft>) => void;
  onSubmit: () => void;
  canAdvance: boolean;
  submitting: boolean;
  isTerminal: boolean;
}) {
  const placement = getPlacement(node.data);
  const multi = placement.tabs.length > 1;
  const pickedId = draft.selected?.[0] ?? null;
  // Show the picked option, or the first one until something is picked.
  const tab = activeTab(placement, pickedId);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}>
      <NodeHeader
        title={node.data.title || "How does this look?"}
        helper={node.data.helper || (multi ? "Pick the option you prefer, then tell us why." : RESPOND_HINT[placement.respond])}
      />

      {multi && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {placement.tabs.map((t, i) => {
            const on = t.id === pickedId;
            return (
              <button
                key={t.id}
                onClick={() => onPatch({ selected: [t.id] })}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 99, cursor: "pointer",
                  fontSize: 13, fontWeight: on ? 600 : 500,
                  background: on ? "var(--accent)" : "var(--surface)",
                  color: on ? "var(--accent-contrast)" : "var(--text-2)",
                  border: "1px solid", borderColor: on ? "transparent" : "var(--border-2)",
                  boxShadow: on ? "var(--glow)" : "var(--shadow-sm)",
                  transition: "all .15s ease",
                }}
              >
                {on && <Check size={13} strokeWidth={3} />}
                {t.name || `Option ${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Cap the width so the stage's own aspect keeps it inside the viewport
          height — no measuring needed, the ratio does the work. */}
      <div style={{ width: "100%", maxWidth: `min(760px, calc(${placement.aspect} * 46vh))` }}>
        <PlacementStage tab={tab} aspect={placement.aspect} radius={14} emptyHint="Preview coming soon" />
      </div>

      <WorkflowAnswerComposer
        slug={slug}
        answer={respondAnswerConfig(placement.respond)}
        text={draft.text ?? ""}
        link={draft.link ?? ""}
        files={draft.files ?? []}
        onChange={onPatch}
        onSubmit={onSubmit}
        submitDisabled={!canAdvance || submitting}
        submitting={submitting}
        isTerminal={isTerminal}
      />
    </div>
  );
}

// ─────────────────────────── Note ───────────────────────────
export function NoteSurface({ node }: { node: SnapNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 640, textAlign: "center" }}>
      <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>Note</span>
      <p style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.5, color: "var(--text)" }}>
        {node.data.text || ""}
      </p>
      <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Continue when ready →</span>
    </div>
  );
}

// NOTE: Editor hand-off cells/attachments are for the EDITOR, hidden from the
// client — so the public surfaces deliberately don't render them. The data still
// travels in the snapshot for the owner's response view.
