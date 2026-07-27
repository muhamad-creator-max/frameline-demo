"use client";

import * as React from "react";
import {
  useWorkflow,
  type WorkflowProject,
  type WorkflowNode,
  type WorkflowEdge,
} from "@/lib/workflow/store";
import type { WorkflowCanvasState } from "@/lib/supabase/database.types";
import { WorkflowCanvas } from "./workflow-canvas";
import { LeftToolbar } from "./left-toolbar";
import { TopBar } from "./top-bar";
import { CanvasEmptyHint } from "./canvas-empty-hint";
import { PreviewModal } from "./preview-modal";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

export function WorkflowBuilder({
  project,
  nodes,
  edges,
  canvas,
}: {
  project: WorkflowProject;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  canvas: WorkflowCanvasState;
}) {
  const hydrate = useWorkflow((s) => s.hydrate);
  const camera = useWorkflow((s) => s.camera);
  const setCamera = useWorkflow((s) => s.setCamera);
  const storeNodes = useWorkflow((s) => s.nodes);
  const dirty = useWorkflow((s) => s.dirty);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 });
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Hydrate the store once from server data.
  React.useEffect(() => {
    hydrate(project, nodes, edges, canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the canvas area size (for toolbar drop position + fit).
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setViewport({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Warn before leaving with unsaved changes.
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Canvas keyboard map: Escape cancels a wire drag / clears the selection,
  // Delete removes every selected node, and Ctrl/⌘ A·C·V·D act on the selection.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Never hijack typing inside a field.
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const s = useWorkflow.getState();

      if (e.key === "Escape") {
        if (s.pending) s.cancelConnection();
        else if (!typing) s.clearSelection();
        return;
      }

      if (typing) return;

      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "a") { e.preventDefault(); s.selectAll(); return; }
        if (k === "c") { s.copySelection(); return; }
        if (k === "v") { s.pasteClipboard(); return; }
        if (k === "d") { e.preventDefault(); s.duplicateSelection(); return; }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedIds.length) { e.preventDefault(); s.removeSelected(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function zoomBy(dir: 1 | -1) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * (1 + dir * 0.15)));
    // zoom toward viewport centre
    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    setCamera({ zoom: next, x: cx - wx * next, y: cy - wy * next });
  }

  function fitToView() {
    if (storeNodes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const pad = 80;
    const minX = Math.min(...storeNodes.map((n) => n.x));
    const minY = Math.min(...storeNodes.map((n) => n.y));
    const maxX = Math.max(...storeNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...storeNodes.map((n) => n.y + n.h + 120)); // include port rows
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(viewport.w / bw, viewport.h / bh)));
    setCamera({
      zoom,
      x: viewport.w / 2 - (minX + (maxX - minX) / 2) * zoom,
      y: viewport.h / 2 - (minY + (maxY - minY) / 2) * zoom,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      <TopBar onPreview={() => setPreviewOpen(true)} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <LeftToolbar viewport={viewport} getCanvasRect={() => wrapRef.current?.getBoundingClientRect() ?? null} />
        <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <WorkflowCanvas />
          {storeNodes.length === 0 && <CanvasEmptyHint />}
          <SelectionPill />
          <ZoomPill zoom={camera.zoom} onZoom={zoomBy} onFit={fitToView} />
        </div>
      </div>
      {previewOpen && <PreviewModal onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/** Bottom-left pill showing the multi-selection count + its group actions. */
function SelectionPill() {
  const count = useWorkflow((s) => s.selectedIds.length);
  const duplicateSelection = useWorkflow((s) => s.duplicateSelection);
  const removeSelected = useWorkflow((s) => s.removeSelected);
  const clearSelection = useWorkflow((s) => s.clearSelection);
  if (count < 2) return null;
  return (
    <div
      style={{
        position: "absolute", left: 20, bottom: 20, zIndex: 10,
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--surface)", border: "1px solid var(--border-raw)",
        borderRadius: 999, padding: "6px 8px 6px 14px", boxShadow: "0 4px 16px rgba(16,24,40,0.10)",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-2)" }}>
        {count} selected
      </span>
      <PillBtn onClick={duplicateSelection}>Duplicate</PillBtn>
      <PillBtn onClick={removeSelected} danger>Delete</PillBtn>
      <PillBtn onClick={clearSelection}>Clear</PillBtn>
    </div>
  );
}

function PillBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid var(--border-raw)", background: "var(--surface)", cursor: "pointer",
        borderRadius: 999, padding: "4px 10px",
        fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
        color: danger ? "var(--danger)" : "var(--text-2)",
      }}
    >
      {children}
    </button>
  );
}

/** Bottom-right zoom control pill (− · % · + · FIT), ported from the design. */
function ZoomPill({ zoom, onZoom, onFit }: { zoom: number; onZoom: (dir: 1 | -1) => void; onFit: () => void }) {
  return (
    <div
      style={{
        position: "absolute", right: 20, bottom: 20, zIndex: 10,
        display: "flex", alignItems: "center", gap: 2,
        background: "var(--surface)", border: "1px solid var(--border-raw)",
        borderRadius: 12, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
      }}
    >
      <ZoomBtn label="Zoom out" onClick={() => onZoom(-1)}>−</ZoomBtn>
      <span style={{ width: 48, textAlign: "center", fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
        {Math.round(zoom * 100)}%
      </span>
      <ZoomBtn label="Zoom in" onClick={() => onZoom(1)}>+</ZoomBtn>
      <span style={{ width: 1, height: 18, background: "var(--border-raw)", margin: "0 2px" }} />
      <button
        onClick={onFit}
        style={{
          height: 28, padding: "0 10px", border: "none", background: "none", borderRadius: 8, cursor: "pointer",
          fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-2)",
        }}
      >
        FIT
      </button>
    </div>
  );
}

function ZoomBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 28, height: 28, border: "none", background: "none", borderRadius: 8, cursor: "pointer",
        fontSize: 15, color: "var(--text-2)", display: "grid", placeItems: "center",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {children}
    </button>
  );
}
