"use client";

import * as React from "react";
import { Stage, Layer, Arrow, Rect, Ellipse, Line, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useReviewStore } from "@/lib/review/store";
import type { AnnotationCoordinates, AnnotationType } from "@/lib/supabase/database.types";
import type { AnnotationDTO } from "@/lib/review/types";
import { coordsToPixels, toPct, type Box } from "@/lib/review/coords";

/**
 * One shape currently on the canvas (either freshly drawn or being edited).
 * Coordinates here are PERCENTAGES (0..1); we render to px via `coordsToPixels`.
 */
interface DrawShape {
  id: string;
  type: AnnotationType;
  coordinates: AnnotationCoordinates;
  color: string;
  strokeWidth: number;
}

export interface AnnotationLayerHandle {
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  clear: () => void;
}

/** Reactive capability flags reported via onStateChange (drive toolbar button states). */
export interface AnnotationLayerState {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

const newLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Konva overlay sized to the media box. Two modes:
 *   - draw (annotating=true): user draws a single shape with the active tool;
 *     on finish it calls `onDraftChange` with normalized coords + opens the
 *     comment composer upstream.
 *   - read (annotating=false): renders `readAnnotations` (saved) and highlights
 *     the active comment's annotations. Selecting + transforming edits geometry
 *     and calls `onEditAnnotation`.
 */
export const AnnotationLayer = React.forwardRef<
  AnnotationLayerHandle,
  {
    box: Box;
    /** Saved annotations to render in read mode (already filtered to the version). */
    readAnnotations: AnnotationDTO[];
    /** Highlight (pulse) these annotation ids. */
    highlightIds: Set<string>;
    /** Whether the layer accepts input (true while annotating). */
    interactive: boolean;
    /** Emits ALL currently-drawn shapes (a comment can hold several). */
    onDraftChange: (drafts: {
      type: AnnotationType;
      coordinates: AnnotationCoordinates;
      color: string;
      strokeWidth: number;
    }[]) => void;
    onEditAnnotation?: (id: string, coordinates: AnnotationCoordinates) => void;
    /** Reports undo/redo/selection availability so the toolbar can react. */
    onStateChange?: (state: AnnotationLayerState) => void;
  }
>(function AnnotationLayer(
  { box, readAnnotations, highlightIds, interactive, onDraftChange, onEditAnnotation, onStateChange },
  ref,
) {
  const tool = useReviewStore((s) => s.tool);
  const color = useReviewStore((s) => s.color);
  const strokeWidth = useReviewStore((s) => s.strokeWidth);

  // Undo/redo stacks hold snapshots of the drawn shapes (draw mode only).
  const [shapes, setShapes] = React.useState<DrawShape[]>([]);
  const [redoStack, setRedoStack] = React.useState<DrawShape[][]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState<DrawShape | null>(null);

  const trRef = React.useRef<Konva.Transformer>(null);
  const shapeRefs = React.useRef<Map<string, Konva.Node>>(new Map());
  // Anchor (in %) where a rect/ellipse drag started, so the box can grow in any direction.
  const anchorRef = React.useRef<{ x: number; y: number } | null>(null);

  // Reset the canvas whenever we leave annotate mode.
  React.useEffect(() => {
    if (!interactive) {
      setShapes([]);
      setRedoStack([]);
      setSelectedId(null);
      setDrawing(null);
    }
  }, [interactive]);

  // Keep the latest callbacks in refs so the draft effect can depend only on
  // `shapes` — depending on the (often inline) callbacks would re-run the effect
  // every render and loop through setState.
  const onDraftChangeRef = React.useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  // Push ALL drawn shapes upstream as the draft set (a comment can carry several).
  React.useEffect(() => {
    onDraftChangeRef.current(
      shapes.map((s) => ({
        type: s.type,
        coordinates: s.coordinates,
        color: s.color,
        strokeWidth: s.strokeWidth,
      })),
    );
  }, [shapes]);

  // Attach the transformer to the selected node (edit existing in read mode).
  React.useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? shapeRefs.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, readAnnotations, shapes]);

  const pushHistory = React.useCallback((next: DrawShape[]) => {
    setShapes(next);
    setRedoStack([]);
  }, []);

  // Report capability flags whenever they change so the toolbar buttons update.
  React.useEffect(() => {
    onStateChange?.({
      canUndo: shapes.length > 0,
      canRedo: redoStack.length > 0,
      hasSelection: selectedId != null,
    });
  }, [shapes.length, redoStack.length, selectedId, onStateChange]);

  React.useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        if (shapes.length === 0) return;
        setRedoStack((r) => [...r, shapes]);
        setShapes(shapes.slice(0, -1));
      },
      redo: () => {
        if (redoStack.length === 0) return;
        setShapes(redoStack[redoStack.length - 1]);
        setRedoStack(redoStack.slice(0, -1));
      },
      deleteSelected: () => {
        if (!selectedId) return;
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      },
      clear: () => {
        setShapes([]);
        setRedoStack([]);
        setSelectedId(null);
      },
    }),
    [shapes, redoStack, selectedId],
  );

  // ── pointer handlers (draw mode) ──
  function pointerPct(e: Konva.KonvaEventObject<PointerEvent>) {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return null;
    return toPct(pos.x, pos.y, box);
  }

  function handleDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!interactive) return;
    // Clicking empty space deselects.
    if (tool === "select") {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const p = pointerPct(e);
    if (!p) return;

    anchorRef.current = { x: p.x, y: p.y };
    const base: DrawShape = {
      id: newLocalId(),
      type: tool as AnnotationType,
      color,
      strokeWidth,
      coordinates:
        tool === "arrow"
          ? { x: p.x, y: p.y, endX: p.x, endY: p.y }
          : tool === "freehand"
            ? { points: [p.x, p.y] }
            : { x: p.x, y: p.y, w: 0, h: 0 },
    };
    setDrawing(base);
  }

  function handleMove(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!interactive || !drawing) return;
    const p = pointerPct(e);
    if (!p) return;

    setDrawing((prev) => {
      if (!prev) return prev;
      const c = { ...prev.coordinates };
      if (prev.type === "arrow") {
        c.endX = p.x;
        c.endY = p.y;
      } else if (prev.type === "freehand") {
        c.points = [...(c.points ?? []), p.x, p.y];
      } else {
        // rect / ellipse — normalize against the fixed anchor so the box can
        // grow in any direction (up/left included).
        const anchor = anchorRef.current ?? { x: c.x ?? 0, y: c.y ?? 0 };
        c.x = Math.min(anchor.x, p.x);
        c.y = Math.min(anchor.y, p.y);
        c.w = Math.abs(p.x - anchor.x);
        c.h = Math.abs(p.y - anchor.y);
      }
      return { ...prev, coordinates: c };
    });
  }

  function handleUp() {
    if (!interactive || !drawing) return;
    // Discard zero-size shapes.
    const c = drawing.coordinates;
    const tiny =
      (drawing.type === "arrow" && c.x === c.endX && c.y === c.endY) ||
      ((drawing.type === "rect" || drawing.type === "ellipse") && (c.w ?? 0) < 0.005 && (c.h ?? 0) < 0.005) ||
      (drawing.type === "freehand" && (c.points?.length ?? 0) < 4);
    if (!tiny) pushHistory([...shapes, drawing]);
    setDrawing(null);
  }

  // ── render a shape (px) ──
  function renderShape(s: DrawShape, opts: { editable?: boolean; highlight?: boolean } = {}) {
    const px = coordsToPixels(s.type, s.coordinates, box);
    const common = {
      stroke: s.color,
      strokeWidth: (opts.highlight ? s.strokeWidth + 1.5 : s.strokeWidth),
      shadowColor: opts.highlight ? s.color : undefined,
      shadowBlur: opts.highlight ? 16 : 0,
      shadowOpacity: opts.highlight ? 0.9 : 0,
      listening: !!opts.editable,
      draggable: !!opts.editable,
    };
    const onSelect = opts.editable ? () => setSelectedId(s.id) : undefined;
    const registerRef = (node: Konva.Node | null) => {
      if (node) shapeRefs.current.set(s.id, node);
      else shapeRefs.current.delete(s.id);
    };
    const onDragEnd = opts.editable
      ? (e: Konva.KonvaEventObject<DragEvent>) => emitEdit(s, e.target)
      : undefined;
    const onTransformEnd = opts.editable
      ? (e: Konva.KonvaEventObject<Event>) => emitEdit(s, e.target)
      : undefined;

    switch (px.type) {
      case "arrow":
        return (
          <Arrow
            key={s.id}
            ref={registerRef}
            points={px.points}
            fill={s.color}
            pointerLength={10}
            pointerWidth={10}
            onPointerDown={onSelect}
            onDragEnd={onDragEnd}
            {...common}
          />
        );
      case "rect":
        return (
          <Rect
            key={s.id}
            ref={registerRef}
            x={px.x}
            y={px.y}
            width={px.width}
            height={px.height}
            cornerRadius={3}
            onPointerDown={onSelect}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
            {...common}
          />
        );
      case "ellipse":
        return (
          <Ellipse
            key={s.id}
            ref={registerRef}
            x={px.x}
            y={px.y}
            radiusX={px.radiusX}
            radiusY={px.radiusY}
            onPointerDown={onSelect}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
            {...common}
          />
        );
      case "freehand":
        return (
          <Line
            key={s.id}
            ref={registerRef}
            points={px.points}
            lineCap="round"
            lineJoin="round"
            tension={0.4}
            onPointerDown={onSelect}
            onDragEnd={onDragEnd}
            {...common}
          />
        );
      case "text":
        return (
          <Text
            key={s.id}
            ref={registerRef}
            x={px.x}
            y={px.y}
            text={px.text}
            fontSize={px.fontSize}
            fill={s.color}
            fontStyle="600"
            onPointerDown={onSelect}
            onDragEnd={onDragEnd}
            listening={!!opts.editable}
            draggable={!!opts.editable}
          />
        );
    }
  }

  /** Translate a dragged/transformed node back to normalized coords + emit. */
  function emitEdit(s: DrawShape, node: Konva.Node) {
    const dx = node.x();
    const dy = node.y();
    // For drag, Konva sets node x/y as an offset from original points for line-based
    // shapes; simplest robust approach: read absolute client rect for box shapes,
    // and for arrows/lines apply the delta to stored percentages.
    const c = { ...s.coordinates };
    if (s.type === "rect" || s.type === "ellipse") {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const wPx = (node.width?.() ?? 0) * scaleX;
      const hPx = (node.height?.() ?? 0) * scaleY;
      // ellipse node x/y is center; rect is top-left.
      let leftPx = dx;
      let topPx = dy;
      if (s.type === "ellipse") {
        leftPx = dx - wPx / 2;
        topPx = dy - hPx / 2;
      }
      c.x = box.width ? leftPx / box.width : 0;
      c.y = box.height ? topPx / box.height : 0;
      c.w = box.width ? Math.abs(wPx) / box.width : 0;
      c.h = box.height ? Math.abs(hPx) / box.height : 0;
      node.scaleX(1);
      node.scaleY(1);
      if (s.type === "rect") {
        (node as Konva.Rect).width(Math.abs(wPx));
        (node as Konva.Rect).height(Math.abs(hPx));
      }
    } else if (s.type === "text") {
      // Text is rendered at an ABSOLUTE position (x={px.x} y={px.y}); after a
      // drag node.x()/node.y() are the new absolute pixel coords, so map them
      // straight to normalized coords (NOT as a delta — that was the bug that
      // snapped text to the top-left).
      c.x = box.width ? dx / box.width : 0;
      c.y = box.height ? dy / box.height : 0;
    } else {
      // arrow / freehand: the node's own x/y start at 0, so node.x()/y() is the
      // drag delta — apply it to every stored point, then reset the node.
      const ddx = box.width ? dx / box.width : 0;
      const ddy = box.height ? dy / box.height : 0;
      if (s.type === "arrow") {
        c.x = (c.x ?? 0) + ddx;
        c.y = (c.y ?? 0) + ddy;
        c.endX = (c.endX ?? 0) + ddx;
        c.endY = (c.endY ?? 0) + ddy;
      } else if (s.type === "freehand" && c.points) {
        c.points = c.points.map((v, i) => v + (i % 2 === 0 ? ddx : ddy));
      }
      node.position({ x: 0, y: 0 });
    }

    // A locally-drawn shape (draft) lives in `shapes`; a saved annotation does
    // not (it comes from readAnnotations).
    const isLocal = shapes.some((x) => x.id === s.id);
    if (isLocal) {
      // Update local state so the move sticks + the draft coords stay in sync
      // for the comment submit.
      setShapes((prev) => prev.map((x) => (x.id === s.id ? { ...x, coordinates: c } : x)));
    } else {
      // Persist edits to already-saved annotations (read mode).
      onEditAnnotation?.(s.id, c);
    }
  }

  const showCursor = interactive && tool !== "select";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: interactive ? 10 : 2,
        // The wrapper itself never eats pointer events; the <Stage> opts back in
        // while interactive, and the text editor (when open) is interactive too.
        pointerEvents: "none",
      }}
    >
      <Stage
        width={box.width}
        height={box.height}
        style={{
          position: "absolute",
          inset: 0,
          cursor: showCursor ? "crosshair" : "default",
          pointerEvents: interactive ? "auto" : "none",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      >
        <Layer>
          {/* read-mode saved annotations — ONLY shown for the comment the user
              explicitly clicked (highlightIds). They no longer appear just from
              the playhead passing their timestamp. */}
          {!interactive &&
            readAnnotations
              .filter((a) => highlightIds.has(a.id))
              .map((a) =>
                renderShape(
                  {
                    id: a.id,
                    type: a.type,
                    coordinates: a.coordinates,
                    color: a.color,
                    strokeWidth: a.strokeWidth,
                  },
                  { editable: !!onEditAnnotation, highlight: true },
                ),
              )}

          {/* draw-mode shapes */}
          {interactive && shapes.map((s) => renderShape(s, { editable: tool === "select" }))}
          {interactive && drawing && renderShape(drawing)}

          <Transformer
            ref={trRef}
            rotateEnabled={false}
            ignoreStroke
            borderStroke="var(--accent)"
            anchorStroke="var(--accent)"
            anchorSize={8}
          />
        </Layer>
      </Stage>
    </div>
  );
});
