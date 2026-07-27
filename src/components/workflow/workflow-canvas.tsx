"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import {
  CARD_W,
  cardWidth,
  inputPortPos,
  outputPortPos,
  portIndex,
  edgePath,
  nearestInput,
  nodeHeight,
  SNAP_RADIUS,
} from "@/lib/workflow/geometry";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { NodeCard } from "./nodes/node-card";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const INNER_W = 4000;
const INNER_H = 3000;
/** Dot pitch in world px. Must match `.workflow-dots` background-size in globals.css. */
const GRID = 18;

/**
 * HTML + SVG canvas (ported from the Canvas Workflow Builder design). An inner
 * layer is translated/scaled by the camera; it holds the SVG bezier connection
 * layer and the absolutely-positioned node cards, so they pan/zoom together.
 *
 * Interaction:
 *  - Pan: drag empty background (Select), drag anywhere (Hand — a transparent
 *    overlay above the cards captures the drag), or hold the middle button.
 *  - Drag nodes by their header (Select tool).
 *  - Connect: drag an output dot; magnetism snaps the wire to the nearest
 *    input within a screen-constant radius, and mouse-up commits the snap.
 *  - Disconnect / re-point: press a connected input dot — it lifts the wire
 *    off (NodeCard calls beginReconnect). Release on empty space to
 *    disconnect, or on another input to re-point. All drops resolve here via
 *    magnetism; node cards have no completion handlers of their own.
 */
export function WorkflowCanvas() {
  const areaRef = React.useRef<HTMLDivElement>(null);

  const nodes = useWorkflow((s) => s.nodes);
  const edges = useWorkflow((s) => s.edges);
  const camera = useWorkflow((s) => s.camera);
  const pending = useWorkflow((s) => s.pending);
  const tool = useWorkflow((s) => s.tool);
  const setCamera = useWorkflow((s) => s.setCamera);
  const selectedIds = useWorkflow((s) => s.selectedIds);
  const setSelection = useWorkflow((s) => s.setSelection);
  const clearSelection = useWorkflow((s) => s.clearSelection);
  const moveSelected = useWorkflow((s) => s.moveSelected);
  const updateNode = useWorkflow((s) => s.updateNode);
  const updatePending = useWorkflow((s) => s.updatePending);
  const endConnection = useWorkflow((s) => s.endConnection);
  const cancelConnection = useWorkflow((s) => s.cancelConnection);
  const markLeftDetach = useWorkflow((s) => s.markLeftDetach);

  // Which input port the pending wire is currently magnetised to (world snap).
  const [snapTarget, setSnapTarget] = React.useState<{ nodeId: string; x: number; y: number } | null>(null);
  // Hovered wire — only thickens it slightly + enlarges its re-grab handle.
  const [hoverEdge, setHoverEdge] = React.useState<string | null>(null);

  // Marquee rectangle in world coords while rubber-band selecting.
  const [marquee, setMarquee] = React.useState<
    { x0: number; y0: number; x1: number; y1: number; additive: boolean } | null
  >(null);

  // Drag state kept in a ref (doesn't need re-render): pan / node / marquee.
  const drag = React.useRef<
    | { mode: "pan"; lastX: number; lastY: number }
    | { mode: "node"; lastX: number; lastY: number }
    | { mode: "marquee"; x0: number; y0: number; additive: boolean; base: string[] }
    | null
  >(null);


  function toWorld(clientX: number, clientY: number) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom,
    };
  }

  function startPan(e: React.MouseEvent) {
    drag.current = { mode: "pan", lastX: e.clientX, lastY: e.clientY };
  }

  function onBackgroundMouseDown(e: React.MouseEvent) {
    // Middle button always pans (design request), regardless of tool/target.
    if (e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault(); // no native text-selection drag across the canvas
    // Select tool: dragging empty canvas rubber-band selects (Windows-style).
    // Shift/Ctrl keeps the existing selection and adds to it.
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const w = toWorld(e.clientX, e.clientY);
    if (!additive) clearSelection();
    drag.current = { mode: "marquee", x0: w.x, y0: w.y, additive, base: additive ? selectedIds : [] };
    setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y, additive });
  }

  // A node card asks the canvas to start dragging it (from its header). The
  // whole selection moves together — NodeCard has already ensured the grabbed
  // node is part of the selection.
  // (Hand mode never reaches this — the pan overlay sits above the cards.)
  const startNodeDrag = React.useCallback((_node: WorkflowNode, e: React.PointerEvent) => {
    drag.current = { mode: "node", lastX: e.clientX, lastY: e.clientY };
  }, []);

  function onMouseMove(e: React.MouseEvent) {
    const d = drag.current;
    if (d?.mode === "pan") {
      setCamera({ ...camera, x: camera.x + (e.clientX - d.lastX), y: camera.y + (e.clientY - d.lastY) });
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    } else if (d?.mode === "node") {
      // Move the entire selection by the pointer delta.
      moveSelected((e.clientX - d.lastX) / camera.zoom, (e.clientY - d.lastY) / camera.zoom);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    } else if (d?.mode === "marquee") {
      const w = toWorld(e.clientX, e.clientY);
      setMarquee({ x0: d.x0, y0: d.y0, x1: w.x, y1: w.y, additive: d.additive });
      // Live-highlight everything the box touches (node bounds vs. rect).
      const minX = Math.min(d.x0, w.x);
      const maxX = Math.max(d.x0, w.x);
      const minY = Math.min(d.y0, w.y);
      const maxY = Math.max(d.y0, w.y);
      const hit = nodes
        .filter((n) => n.x < maxX && n.x + cardWidth(n) > minX && n.y < maxY && n.y + nodeHeight(n) > minY)
        .map((n) => n.id);
      setSelection(d.additive ? Array.from(new Set([...d.base, ...hit])) : hit);
    }
    if (pending) {
      const w = toWorld(e.clientX, e.clientY);
      // Screen-constant snap radius: divide by zoom so magnetism feels the
      // same whether zoomed in or out.
      const radius = SNAP_RADIUS / camera.zoom;
      // While reconnecting, ignore the node we detached from until the pointer
      // has left its snap radius once — otherwise a small drag re-grabs it and
      // it never disconnects.
      let candidates = nodes;
      if (pending.detachedFrom && !pending.hasLeftDetach) {
        const from = byId.get(pending.detachedFrom);
        if (from) {
          const p = inputPortPos(from);
          if (Math.hypot(p.x - w.x, p.y - w.y) > radius) markLeftDetach();
          else candidates = nodes.filter((n) => n.id !== pending.detachedFrom);
        }
      }
      // Magnetism: snap the live end to the nearest input port in range.
      const near = nearestInput(w, candidates, pending.sourceNodeId, radius);
      if (near) {
        setSnapTarget({ nodeId: near.nodeId, x: near.pos.x, y: near.pos.y });
        updatePending(near.pos.x, near.pos.y);
      } else {
        setSnapTarget(null);
        updatePending(w.x, w.y);
      }
    }
  }

  function finishConnection() {
    // Commit to the magnetised input if we have one, else cancel/unwire.
    if (snapTarget) endConnection(snapTarget.nodeId);
    else cancelConnection();
    setSnapTarget(null);
  }

  function onMouseUp() {
    const d = drag.current;
    // A finished group drag marks the doc dirty (moveSelected stays cheap).
    if (d?.mode === "node" && selectedIds[0]) updateNode(selectedIds[0], {});
    if (d?.mode === "marquee") setMarquee(null);
    drag.current = null;
    if (pending) finishConnection();
  }

  /**
   * Global drag lifecycle. Two things make this necessary:
   *
   *  1. Releasing over a node card/port never reaches this div's own handlers
   *     (they stop propagation), which would strand the drag on the cursor.
   *  2. Node drags start on `pointerdown` and call preventDefault() (to kill the
   *     native text-selection drag). preventDefault on a pointer event
   *     suppresses the compatibility mouse events — so a `mouseup` listener
   *     NEVER fires for those drags. We must listen on POINTER events to match.
   *
   * Handlers are read through a ref so the listeners bind once but always run
   * the latest closure.
   */
  const latest = React.useRef({ onMouseMove, onMouseUp });
  latest.current = { onMouseMove, onMouseUp };

  React.useEffect(() => {
    function isDragging() {
      return !!drag.current || !!useWorkflow.getState().pending;
    }
    function handleMove(e: PointerEvent) {
      if (!isDragging()) return;
      latest.current.onMouseMove(e as unknown as React.MouseEvent);
    }
    function handleUp() {
      if (!isDragging()) return;
      latest.current.onMouseUp();
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    // pointercancel fires if the gesture is interrupted (touch, focus loss);
    // treat it as a release so nothing stays stuck.
    window.addEventListener("pointercancel", handleUp);
    // Safety net: if the button is already up but a drag is somehow still live
    // (e.g. a release swallowed while the tab was hidden), end it on the next move.
    function safety(e: MouseEvent) {
      if (e.buttons === 0 && drag.current) latest.current.onMouseUp();
    }
    window.addEventListener("mousemove", safety);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("mousemove", safety);
    };
  }, []);

  // Wheel: ctrl/⌘ = zoom toward cursor, else pan.
  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const oldZoom = camera.zoom;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * (1 + (e.deltaY > 0 ? -1 : 1) * 0.12)));
      const wx = (px - camera.x) / oldZoom;
      const wy = (py - camera.y) / oldZoom;
      setCamera({ zoom: next, x: px - wx * next, y: py - wy * next });
    } else {
      setCamera({ ...camera, x: camera.x - e.deltaX, y: camera.y - e.deltaY });
    }
  }

  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // On-screen dot pitch. Doubling the world pitch when zoomed far out keeps the
  // field from turning into dense noise at 0.4x.
  const gridPx = GRID * camera.zoom * (camera.zoom < 0.7 ? 2 : 1);

  const cursor =
    drag.current?.mode === "pan"
      ? "grabbing"
      : tool === "hand"
      ? "grab"
      : pending
      ? "crosshair"
      : marquee
      ? "crosshair"
      : "default";

  return (
    <div
      ref={areaRef}
      // Pointer events throughout: node drags start on pointerdown, so the whole
      // lifecycle must live in the same event family (see the effect above).
      onPointerDown={onBackgroundMouseDown}
      onWheel={onWheel}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--canvas)",
        cursor,
        // Never let native text selection fight canvas dragging. Card copy is
        // still selectable inside inputs/textareas, which set their own value.
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Dotted field. It lives on the STATIC outer box (not the transformed
          inner layer, which is a finite 4000x3000 rect that runs out when you
          pan/zoom). Syncing background-position/size to the camera makes the
          grid effectively infinite while still tracking pan and zoom. */}
      <div
        className="workflow-dots"
        style={{
          position: "absolute",
          inset: 0,
          backgroundSize: `${gridPx}px ${gridPx}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          pointerEvents: "none",
        }}
      />

      {/* Transformed inner layer (SVG wires + cards). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: INNER_W,
          height: INNER_H,
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg style={{ position: "absolute", left: 0, top: 0, width: INNER_W, height: INNER_H, pointerEvents: "none", overflow: "visible" }}>
          {edges.map((edge) => {
            const src = byId.get(edge.source_node_id);
            const tgt = byId.get(edge.target_node_id);
            if (!src || !tgt) return null;
            const idx = portIndex(src, edge.source_port);
            if (idx < 0) return null;
            const a = outputPortPos(src, idx);
            const b = inputPortPos(tgt);
            const color = NODE_THEME[src.kind].accent;
            const path = edgePath(a.x, a.y, b.x, b.y);
            const isHover = hoverEdge === edge.id;
            return (
              <g key={edge.id} style={{ pointerEvents: "stroke" }}>
                {/* Fat invisible hit area for hover (to enlarge the re-grab handle). */}
                <path
                  d={path}
                  stroke="transparent"
                  strokeWidth={16}
                  fill="none"
                  onMouseEnter={() => setHoverEdge(edge.id)}
                  onMouseLeave={() => setHoverEdge((h) => (h === edge.id ? null : h))}
                />
                {/* Visible wire. The wire's end is grabbed via the target
                    node's input dot (it sits above this SVG layer), which
                    lifts the edge off through beginReconnect. */}
                <path
                  d={path}
                  stroke={color}
                  strokeWidth={isHover ? 3 : 2}
                  fill="none"
                  style={{ transition: "stroke-width .1s ease" }}
                />
              </g>
            );
          })}

          {/* Dashed preview while connecting. */}
          {pending && (() => {
            const src = byId.get(pending.sourceNodeId);
            if (!src) return null;
            const idx = portIndex(src, pending.sourcePort);
            if (idx < 0) return null;
            const a = outputPortPos(src, idx);
            const color = NODE_THEME[src.kind].accent;
            return (
              <>
                <path d={edgePath(a.x, a.y, pending.x, pending.y)} stroke={color} strokeWidth={2} strokeDasharray="6 5" fill="none" />
                {/* Snap indicator ring when magnetised to an input. */}
                {snapTarget && (
                  <circle cx={snapTarget.x} cy={snapTarget.y} r={9} fill="none" stroke={color} strokeWidth={2} className="wf-snap-ring" />
                )}
              </>
            );
          })()}
        </svg>

        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} zoom={camera.zoom} onStartDrag={startNodeDrag} />
        ))}

        {/* Rubber-band selection rectangle (world coords, so it pans/zooms). */}
        {marquee && (
          <div
            style={{
              position: "absolute",
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              border: `${1 / camera.zoom}px solid var(--accent)`,
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              borderRadius: 2 / camera.zoom,
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        )}
      </div>

      {/* Hand tool: a transparent overlay above the cards captures every drag
          for panning, so nodes/ports are untouchable while navigating. */}
      {tool === "hand" && (
        <div
          onPointerDown={(e) => {
            if (e.button !== 0 && e.button !== 1) return;
            e.preventDefault();
            startPan(e);
          }}
          style={{ position: "absolute", inset: 0, zIndex: 5 }}
        />
      )}
    </div>
  );
}

export { CARD_W };
