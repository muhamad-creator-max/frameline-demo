"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { cardWidth, INPUT_PORT_Y } from "@/lib/workflow/geometry";
import { QuestionBody } from "./question-body";
import { ChoiceBody } from "./choice-body";
import { IdentityBody } from "./identity-body";
import { NoteBody } from "./note-body";
import { PlacementBody } from "./placement-body";
import { PortDot } from "./node-parts";
import {
  QuestionSettings, ChoiceSettings, IdentitySettings, NoteSettings, PlacementSettings,
} from "./node-settings";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * A node card (design's shared shell): input dot, grab-header with accent dot +
 * JB-Mono type label, a type-specific body, then a bottom "Settings" accordion
 * bar that expands an in-card settings panel. No sidebar — everything is here.
 */
export function NodeCard({
  node,
  zoom,
  onStartDrag,
}: {
  node: WorkflowNode;
  zoom: number;
  onStartDrag: (node: WorkflowNode, e: React.PointerEvent) => void;
}) {
  const theme = NODE_THEME[node.kind];
  const selected = useWorkflow((s) => s.selectedIds.includes(node.id));
  const selectNode = useWorkflow((s) => s.selectNode);
  const toggleSelected = useWorkflow((s) => s.toggleSelected);
  const settingsOpen = useWorkflow((s) => s.openSettingsNodeId === node.id);
  const toggleSettings = useWorkflow((s) => s.toggleSettings);
  // Input accepts many incoming wires — fill the dot once at least one lands.
  const hasIncoming = useWorkflow((s) => s.edges.some((e) => e.target_node_id === node.id));
  // Pulse only when this node is a valid drop target for the live wire.
  const connecting = useWorkflow((s) => s.pending !== null && s.pending.sourceNodeId !== node.id);

  const isStart = node.kind === "start";

  /**
   * Shared click-selection rule. Shift/Ctrl toggles this node in the selection;
   * a plain click on an already-selected node keeps the whole group (so you can
   * drag a multi-selection by any member), otherwise it selects just this one.
   */
  function applySelection(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSelected(node.id);
    else if (!selected) selectNode(node.id);
  }

  function onHeaderPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return; // middle/right bubble up (canvas pans)
    e.stopPropagation();
    e.preventDefault(); // no native text-selection drag while moving the card
    applySelection(e);
    onStartDrag(node, e);
  }

  /**
   * The input dot doubles as the wire-end grip: pressing it when wires are
   * attached lifts the most recent one off (beginReconnect) so it can be
   * dropped elsewhere — or on empty space to disconnect. The canvas owns the
   * rest of the drag; releasing is handled by its magnetism/mouse-up.
   */
  // Pointer (not mouse) events — the canvas ends drags on pointerup, and the
  // preventDefault() below kills the compatibility mouse events entirely.
  function onInputDotMouseDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const { edges, beginReconnect } = useWorkflow.getState();
    const incoming = edges.filter((ed) => ed.target_node_id === node.id);
    const last = incoming[incoming.length - 1];
    if (!last) return; // nothing attached — let the card handle the click
    e.stopPropagation();
    e.preventDefault(); // no native text-selection drag
    beginReconnect(last.id, node.x, node.y + INPUT_PORT_Y);
  }

  return (
    <div
      // Pointer events, matching the canvas — a mouse-only handler here would
      // not stop the canvas's pointerdown, so clicking a card would also start
      // a marquee selection behind it.
      onPointerDown={(e) => {
        // Middle/right buttons bubble to the canvas (middle-click pan works
        // over cards too). Left click selects the node wherever it lands.
        if (e.button !== 0) return;
        e.stopPropagation();
        applySelection(e);
      }}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        // Placement cards are wider (they hold a preview) — geometry owns the
        // per-kind width so port dots and wires stay in sync.
        width: cardWidth(node),
        background: "var(--surface)",
        border: `1px solid ${selected ? theme.accent : "var(--border-raw)"}`,
        borderRadius: 16,
        boxShadow: selected
          ? `0 0 0 2px color-mix(in srgb, ${theme.accent} 28%, transparent), 0 8px 24px rgba(16,24,40,.10)`
          : "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        overflow: "visible",
      }}
    >
      {/* Input port dot (left edge). Accepts many wires — filled once connected.
          Pressing it grabs the attached wire's end (drag off to disconnect);
          drops are completed by the canvas's magnetism, not a handler here. */}
      {!isStart && (
        <div
          onPointerDown={onInputDotMouseDown}
          title={hasIncoming ? "Drag to detach the wire" : "Input — connect wires here"}
          style={{
            position: "absolute", left: -14, top: INPUT_PORT_Y - 14,
            width: 28, height: 28, borderRadius: "50%",
            display: "grid", placeItems: "center", zIndex: 2,
            cursor: connecting ? "pointer" : hasIncoming ? "grab" : "default",
          }}
        >
          <span
            className={connecting ? "status-dot-pulse" : undefined}
            style={{
              width: 12, height: 12, borderRadius: "50%",
              background: hasIncoming ? theme.accent : "var(--surface)",
              border: `2px solid ${theme.accent}`,
              boxShadow: "0 0 0 3px var(--surface)",
              color: theme.accent,
            }}
          />
        </div>
      )}

      {/* Header (drag handle). Start has no body, so it carries its own single
          "out" port dot here — geometry puts that port at HEADER_H / 2. */}
      <div
        onPointerDown={onHeaderPointerDown}
        style={{
          height: 48, display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
          borderBottom: "1px solid rgba(0,0,0,0.06)", cursor: "grab",
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          background: isStart ? theme.soft : "transparent",
          position: isStart ? "relative" : undefined,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.accent }}>
          {theme.label}
        </span>
        <span style={{ flex: 1 }} />
        {isStart && <PortDot node={node} portId="out" accent={theme.accent} />}
      </div>

      {/* Body */}
      {node.kind === "question" && <QuestionBody node={node} zoom={zoom} />}
      {node.kind === "choice" && <ChoiceBody node={node} zoom={zoom} />}
      {node.kind === "identity" && <IdentityBody node={node} zoom={zoom} />}
      {node.kind === "note" && <NoteBody node={node} zoom={zoom} />}
      {node.kind === "placement" && <PlacementBody node={node} zoom={zoom} />}

      {/* Settings accordion bar (bottom) */}
      {!isStart && (
        <>
          <div style={{ display: "flex", justifyContent: "center", padding: "5px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleSettings(node.id); }}
              style={{
                display: "flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer",
                fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                color: "var(--text-3)", padding: "4px 10px", borderRadius: 999,
              }}
            >
              <span>{settingsOpen ? "⌃" : "⌄"}</span>
              <span>Settings</span>
            </button>
          </div>

          {settingsOpen && (
            <div
              style={{
                borderTop: "1px solid var(--border-raw)", padding: 12, background: "var(--surface-2)",
                borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
                Node settings
              </span>
              {node.kind === "question" && <QuestionSettings node={node} />}
              {node.kind === "choice" && <ChoiceSettings node={node} />}
              {node.kind === "identity" && <IdentitySettings node={node} />}
              {node.kind === "note" && <NoteSettings />}
              {node.kind === "placement" && <PlacementSettings node={node} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
