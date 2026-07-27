"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { PortDot, HandoffIcon, HandoffPanel } from "./node-parts";

/**
 * Choice body (design): question textarea (64px) + one 40px row per choice
 * (label input, hover hand-off icon, delete, output port), then a dashed
 * "+ Add choice" button (max 8).
 */
export function ChoiceBody({ node }: { node: WorkflowNode; zoom: number }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const updateChoice = useWorkflow((s) => s.updateChoice);
  const removeChoice = useWorkflow((s) => s.removeChoice);
  const addChoice = useWorkflow((s) => s.addChoice);
  const accent = NODE_THEME.choice.accent;

  const hovered = useWorkflow((s) => s.hoveredHandoffKey);
  const setHovered = useWorkflow((s) => s.setHoveredHandoff);
  const openHandoff = useWorkflow((s) => s.openHandoff);

  const choices = node.data.choices ?? [];

  return (
    <>
      <div style={{ height: 64, boxSizing: "border-box", padding: "10px 12px 4px" }}>
        <textarea
          value={node.data.title ?? ""}
          onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Type your question…"
          style={textareaStyle}
        />
      </div>
      <div>
        {choices.map((c) => {
          const optKey = `c_${c.id}`;
          const showIcon = hovered === optKey || (openHandoff?.nodeId === node.id && openHandoff.key === optKey);
          const panelOpen = openHandoff?.nodeId === node.id && openHandoff.key === optKey;
          return (
            <div key={c.id}>
              <div
                onMouseEnter={() => setHovered(optKey)}
                onMouseLeave={() => setHovered(null)}
                style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", position: "relative" }}
              >
                <input
                  value={c.label}
                  onChange={(e) => updateChoice(node.id, c.id, { label: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={choiceInput}
                />
                {showIcon && <HandoffIcon nodeId={node.id} optionKey={optKey} />}
                <button onClick={(e) => { e.stopPropagation(); removeChoice(node.id, c.id); }} style={delBtn}>×</button>
                <PortDot node={node} portId={c.id} accent={accent} />
              </div>
              {panelOpen && <HandoffPanel node={node} optionKey={optKey} />}
            </div>
          );
        })}
        <div style={{ height: 36, display: "flex", alignItems: "center", padding: "0 12px" }}>
          {choices.length < 8 && (
            <button onClick={(e) => { e.stopPropagation(); addChoice(node.id); }} style={addBtn}>+ Add choice</button>
          )}
        </div>
      </div>
    </>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%", height: "100%", boxSizing: "border-box", resize: "none",
  border: "1px solid var(--border-raw)", borderRadius: 10, padding: "8px 10px",
  fontFamily: "inherit", fontSize: 13, color: "var(--text)", outline: "none", background: "var(--surface)",
};
const choiceInput: React.CSSProperties = {
  flex: 1, minWidth: 0, border: "1px solid var(--border-raw)", borderRadius: 8, padding: "6px 8px",
  fontFamily: "inherit", fontSize: 12, color: "var(--text)", outline: "none", background: "var(--surface)",
};
const delBtn: React.CSSProperties = { border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, flexShrink: 0 };
const addBtn: React.CSSProperties = { border: "1px dashed var(--border-2)", background: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "var(--text-3)", cursor: "pointer" };
