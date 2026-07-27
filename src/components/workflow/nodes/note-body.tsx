"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { PortDot, HandoffIcon, HandoffPanel } from "./node-parts";

/**
 * Note body (design): a 130px textarea with a hover-revealed hand-off icon
 * (top-right) and a single output port dot centered on the body's right edge.
 */
export function NoteBody({ node }: { node: WorkflowNode; zoom: number }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const accent = NODE_THEME.note.accent;

  const hovered = useWorkflow((s) => s.hoveredHandoffKey);
  const setHovered = useWorkflow((s) => s.setHoveredHandoff);
  const openHandoff = useWorkflow((s) => s.openHandoff);

  const optKey = "note";
  const showIcon = hovered === optKey || (openHandoff?.nodeId === node.id && openHandoff.key === optKey);
  const panelOpen = openHandoff?.nodeId === node.id && openHandoff.key === optKey;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(optKey)}
        onMouseLeave={() => setHovered(null)}
        style={{ height: 130, boxSizing: "border-box", padding: "10px 12px", position: "relative" }}
      >
        <textarea
          value={node.data.text ?? ""}
          onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write a note for the client…"
          style={{
            width: "100%", height: "100%", boxSizing: "border-box", resize: "none",
            border: "1px solid var(--border-raw)", borderRadius: 10, padding: "8px 10px",
            fontFamily: "inherit", fontSize: 13, color: "var(--text)", outline: "none", background: "var(--surface)",
          }}
        />
        {showIcon && (
          <span style={{ position: "absolute", top: 16, right: 20, background: "var(--surface)", borderRadius: 4 }}>
            <HandoffIcon nodeId={node.id} optionKey={optKey} />
          </span>
        )}
        <PortDot node={node} portId="out" accent={accent} />
      </div>
      {panelOpen && <HandoffPanel node={node} optionKey={optKey} />}
    </>
  );
}
