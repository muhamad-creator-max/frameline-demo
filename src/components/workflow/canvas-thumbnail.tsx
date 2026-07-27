"use client";

import * as React from "react";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { CARD_W } from "@/lib/workflow/geometry";
import type { WorkflowNodeKind } from "@/lib/supabase/database.types";

export interface ThumbNode {
  id: string;
  kind: WorkflowNodeKind;
  x: number;
  y: number;
}
export interface ThumbEdge {
  from: string;
  to: string;
}

/** Approximate card height used only for laying out the thumbnail's bounding box. */
const CARD_H = 190;
const PAD = 12;

/**
 * A miniature render of a workflow's actual canvas: real node positions and
 * kinds, scaled to fit the card's preview strip. Nodes keep their node-type
 * accent so a flow is recognisable at a glance.
 */
export function CanvasThumbnail({
  nodes,
  edges,
  width,
  height,
}: {
  nodes: ThumbNode[];
  edges: ThumbEdge[];
  width: number;
  height: number;
}) {
  const layout = React.useMemo(() => {
    if (nodes.length === 0) return null;

    // Bounding box of the real graph (in canvas world coords).
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + CARD_W));
    const maxY = Math.max(...nodes.map((n) => n.y + CARD_H));
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    // Contain the graph in the strip, never magnifying past 1:1.
    const scale = Math.min((width - PAD * 2) / bw, (height - PAD * 2) / bh, 1);
    // Centre whatever's left over.
    const offX = (width - bw * scale) / 2 - minX * scale;
    const offY = (height - bh * scale) / 2 - minY * scale;

    const pos = new Map(nodes.map((n) => [n.id, { x: n.x * scale + offX, y: n.y * scale + offY }]));
    return { scale, pos };
  }, [nodes, width, height]);

  if (!layout) {
    return (
      <div style={{ width, height, display: "grid", placeItems: "center" }}>
        <span className="cv-meta" style={{ fontSize: 9, color: "var(--text-3)" }}>Empty canvas</span>
      </div>
    );
  }

  const { scale, pos } = layout;
  const nw = Math.max(10, CARD_W * scale);
  const nh = Math.max(8, CARD_H * scale);

  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden>
      {/* Connections, drawn first so cards sit on top. */}
      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + nw;
        const y1 = a.y + nh / 2;
        const x2 = b.x;
        const y2 = b.y + nh / 2;
        const dx = Math.max(10, Math.abs(x2 - x1) * 0.5);
        return (
          <path
            key={`${e.from}-${e.to}-${i}`}
            d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
            stroke="var(--border-2)"
            strokeWidth={1.25}
            fill="none"
          />
        );
      })}

      {/* Mini node cards: accent bar on top, muted body lines. */}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        const accent = NODE_THEME[n.kind].accent;
        const r = Math.min(4, nw / 5);
        return (
          <g key={n.id}>
            <rect
              x={p.x} y={p.y} width={nw} height={nh} rx={r}
              fill="var(--surface)" stroke="var(--border-raw)" strokeWidth={1}
            />
            {/* accent header bar */}
            <rect
              x={p.x + nw * 0.14} y={p.y + nh * 0.16}
              width={nw * 0.55} height={Math.max(1.5, nh * 0.1)}
              rx={1} fill={accent}
            />
            {/* body lines */}
            <rect
              x={p.x + nw * 0.14} y={p.y + nh * 0.42}
              width={nw * 0.72} height={Math.max(1, nh * 0.07)}
              rx={1} fill="var(--border-2)"
            />
            <rect
              x={p.x + nw * 0.14} y={p.y + nh * 0.60}
              width={nw * 0.45} height={Math.max(1, nh * 0.07)}
              rx={1} fill="var(--border-2)"
            />
          </g>
        );
      })}
    </svg>
  );
}
