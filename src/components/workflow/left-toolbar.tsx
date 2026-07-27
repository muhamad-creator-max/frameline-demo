"use client";

import * as React from "react";
import { useWorkflow } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { cardWidthForKind } from "@/lib/workflow/geometry";
import type { WorkflowNodeKind } from "@/lib/supabase/database.types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

type ToolKind = Exclude<WorkflowNodeKind, "start">;

const TOOLS: { kind: ToolKind; label: string }[] = [
  { kind: "question", label: "Ask" },
  { kind: "choice", label: "Choice" },
  { kind: "identity", label: "Identity" },
  { kind: "placement", label: "Place" },
  { kind: "note", label: "Note" },
];

/**
 * Fixed 72px left rail. Two groups:
 *  - Pointer tools (Select / Hand) that set the canvas interaction mode.
 *  - Node tiles you drag onto the canvas to drop a node at the cursor (a click
 *    without dragging still drops one near the viewport centre as a fallback).
 *
 * `getCanvasRect` returns the canvas area's screen rect so a drop's client
 * coords can be converted to world space using the live camera.
 */
export function LeftToolbar({
  viewport,
  getCanvasRect,
}: {
  viewport: { w: number; h: number };
  getCanvasRect: () => DOMRect | null;
}) {
  const addNode = useWorkflow((s) => s.addNode);
  const camera = useWorkflow((s) => s.camera);
  const tool = useWorkflow((s) => s.tool);
  const setTool = useWorkflow((s) => s.setTool);
  const hasStart = useWorkflow((s) => s.nodes.some((n) => n.kind === "start"));
  const nodeCount = useWorkflow((s) => s.nodes.length);

  // Floating drag ghost while dragging a node tile out onto the canvas.
  const [ghost, setGhost] = React.useState<{ kind: WorkflowNodeKind; x: number; y: number } | null>(null);
  const dragState = React.useRef<{ kind: WorkflowNodeKind; moved: boolean } | null>(null);

  // Fallback: click a tile (no drag) drops near the viewport centre, cascaded.
  // addNode selects the new node itself.
  function dropAtCentre(kind: WorkflowNodeKind) {
    const cx = (viewport.w / 2 - camera.x) / camera.zoom;
    const cy = (viewport.h / 2 - camera.y) / camera.zoom;
    const cascade = (nodeCount % 6) * 26;
    addNode(kind, cx - cardWidthForKind(kind) / 2 + cascade, cy - 90 + cascade);
  }

  // Drop at a specific screen point (end of a drag), converting to world coords.
  function dropAtClient(kind: WorkflowNodeKind, clientX: number, clientY: number) {
    const rect = getCanvasRect();
    if (!rect) return dropAtCentre(kind);
    // Only drop if released over the canvas area; otherwise ignore.
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    const wx = (clientX - rect.left - camera.x) / camera.zoom;
    const wy = (clientY - rect.top - camera.y) / camera.zoom;
    // Cursor sits at the card's top-centre so the drop lands where you aim.
    addNode(kind, wx - cardWidthForKind(kind) / 2, wy - 12);
  }

  function onTilePointerDown(kind: WorkflowNodeKind, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragState.current = { kind, moved: false };

    const onMove = (ev: PointerEvent) => {
      if (!dragState.current) return;
      dragState.current.moved = true;
      setGhost({ kind, x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const st = dragState.current;
      dragState.current = null;
      setGhost(null);
      if (!st) return;
      if (st.moved) dropAtClient(kind, ev.clientX, ev.clientY);
      else dropAtCentre(kind); // treated as a click
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <div
        style={{
          width: 72,
          flexShrink: 0,
          borderInlineEnd: "1px solid var(--border-raw)",
          background: "var(--bg-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0",
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* Move (hand) tool — toggles off back to the default Select mode,
            where dragging empty canvas rubber-band selects nodes. */}
        <PointerTool
          label="Move"
          active={tool === "hand"}
          onClick={() => setTool(tool === "hand" ? "select" : "hand")}
        >
          <HandGlyph />
        </PointerTool>

        <div style={{ width: 40, height: 1, background: "var(--border-raw)", margin: "2px 0" }} />

        {/* Node tiles (drag onto canvas, or click to drop at centre) */}
        {!hasStart && (
          <>
            <Tool kind="start" label="Start" onPointerDown={(e) => onTilePointerDown("start", e)} />
            <div style={{ width: 40, height: 1, background: "var(--border-raw)" }} />
          </>
        )}
        {TOOLS.map((t) => (
          <Tool key={t.kind} kind={t.kind} label={t.label} onPointerDown={(e) => onTilePointerDown(t.kind, e)} />
        ))}
      </div>

      {/* Drag ghost, following the cursor (rendered to the document flow root). */}
      {ghost && (
        <div
          style={{
            position: "fixed",
            left: ghost.x + 12,
            top: ghost.y + 12,
            zIndex: 1000,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--surface)",
            border: `1px solid ${NODE_THEME[ghost.kind].accent}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(16,24,40,.18)",
            opacity: 0.95,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: NODE_THEME[ghost.kind].accent }} />
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: NODE_THEME[ghost.kind].accent }}>
            {NODE_THEME[ghost.kind].label}
          </span>
        </div>
      )}
    </>
  );
}

/* ── Pointer-tool button (Select / Move) ── */
function PointerTool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 2,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: active ? "var(--accent)" : "var(--surface)",
          border: `1px solid ${active ? "var(--accent)" : "var(--border-raw)"}`,
          color: active ? "var(--accent-contrast)" : "var(--text-2)",
          transition: "background .12s ease, border-color .12s ease",
        }}
      >
        {children}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: active ? "var(--text)" : "var(--text-3)" }}>
        {label}
      </span>
    </button>
  );
}

function HandGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8V4.2a1 1 0 012 0V7m0 0V3.5a1 1 0 012 0V7m0 0V4.2a1 1 0 012 0V9c0 2.5-1.6 4.5-4 4.5S5 12 4.2 10.5L3.2 8.8a1 1 0 011.6-1.1L5 8z" />
    </svg>
  );
}

function Tool({ kind, label, onPointerDown }: { kind: WorkflowNodeKind; label: string; onPointerDown: (e: React.PointerEvent) => void }) {
  const theme = NODE_THEME[kind];
  return (
    <button
      onPointerDown={onPointerDown}
      aria-label={`Add ${label} (drag onto canvas)`}
      title={`Drag onto the canvas — or click to place`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: "none",
        cursor: "grab",
        padding: 4,
        touchAction: "none",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: theme.soft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .12s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px) scale(1.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
      >
        <Glyph kind={kind} accent={theme.accent} />
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** Mini-glyphs recreated from the design (bars / squares / question mark). */
function Glyph({ kind, accent }: { kind: WorkflowNodeKind; accent: string }) {
  if (kind === "question") {
    return (
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: accent }}>?</span>
    );
  }
  if (kind === "start") {
    // small right-pointing triangle
    return (
      <span
        style={{
          width: 0,
          height: 0,
          borderTop: "7px solid transparent",
          borderBottom: "7px solid transparent",
          borderLeft: `11px solid ${accent}`,
          marginLeft: 3,
        }}
      />
    );
  }
  if (kind === "choice") {
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
        <span style={{ width: 20, height: 3, borderRadius: 2, background: accent }} />
        <span style={{ width: 14, height: 3, borderRadius: 2, background: accent }} />
        <span style={{ width: 17, height: 3, borderRadius: 2, background: accent }} />
      </span>
    );
  }
  if (kind === "identity") {
    return <span style={{ width: 14, height: 14, borderRadius: 4, background: accent }} />;
  }
  if (kind === "placement") {
    // A frame with a caption bar sitting on it.
    return (
      <span style={{ position: "relative", width: 22, height: 15, borderRadius: 3, border: `1.6px solid ${accent}`, display: "block" }}>
        <span style={{ position: "absolute", left: 3, bottom: 2.5, width: 12, height: 3, borderRadius: 1, background: accent }} />
      </span>
    );
  }
  // note — three thin lines
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
      <span style={{ width: 22, height: 2.5, borderRadius: 2, background: accent }} />
      <span style={{ width: 22, height: 2.5, borderRadius: 2, background: accent }} />
      <span style={{ width: 14, height: 2.5, borderRadius: 2, background: accent }} />
    </span>
  );
}
