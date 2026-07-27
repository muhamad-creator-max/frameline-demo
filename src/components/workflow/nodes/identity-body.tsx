"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { ensureFontLoaded } from "@/lib/workflow/google-fonts";
import { PortDot, HandoffIcon, HandoffPanel } from "./node-parts";
import type { IdentityBox } from "@/lib/supabase/database.types";

/**
 * Identity body (design): one 56px row per box. The box is the styled
 * inline-editable pill the client will see (its own bg/text/radius/shadow/font).
 * Hover reveals its hand-off icon; a dashed "+ Add box" adds up to max_answers.
 */
export function IdentityBody({ node }: { node: WorkflowNode; zoom: number }) {
  const updateBox = useWorkflow((s) => s.updateBox);
  const removeBox = useWorkflow((s) => s.removeBox);
  const addBox = useWorkflow((s) => s.addBox);
  const accent = NODE_THEME.identity.accent;

  const hovered = useWorkflow((s) => s.hoveredHandoffKey);
  const setHovered = useWorkflow((s) => s.setHoveredHandoff);
  const openHandoff = useWorkflow((s) => s.openHandoff);

  const boxes = node.data.boxes ?? [];
  const max = node.data.max_answers ?? 3;

  const fontKey = boxes.map((b) => b.font).join("|");
  React.useEffect(() => {
    for (const f of fontKey.split("|")) ensureFontLoaded(f);
  }, [fontKey]);

  return (
    <div>
      {boxes.map((b) => {
        const optKey = `i_${b.id}`;
        const showIcon = hovered === optKey || (openHandoff?.nodeId === node.id && openHandoff.key === optKey);
        const panelOpen = openHandoff?.nodeId === node.id && openHandoff.key === optKey;
        return (
          <div key={b.id}>
            <div
              onMouseEnter={() => setHovered(optKey)}
              onMouseLeave={() => setHovered(null)}
              style={{ height: 56, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", position: "relative" }}
            >
              <input
                value={b.text}
                onChange={(e) => updateBox(node.id, b.id, { text: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                style={boxStyle(b)}
              />
              {showIcon && <HandoffIcon nodeId={node.id} optionKey={optKey} />}
              <button onClick={(e) => { e.stopPropagation(); removeBox(node.id, b.id); }} style={delBtn}>×</button>
              <PortDot node={node} portId={b.id} accent={accent} />
            </div>
            {panelOpen && <HandoffPanel node={node} optionKey={optKey} />}
          </div>
        );
      })}
      <div style={{ padding: "0 12px 10px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {boxes.length < max && (
          <button onClick={(e) => { e.stopPropagation(); addBox(node.id); }} style={addBtn}>+ Add box</button>
        )}
      </div>
    </div>
  );
}

function boxStyle(b: IdentityBox): React.CSSProperties {
  return {
    width: "100%", flex: 1, height: 40, boxSizing: "border-box", border: "none", outline: "none",
    textAlign: "center", fontSize: 12, fontWeight: 600, padding: "0 10px",
    background: b.bg, color: b.color, borderRadius: b.radius,
    fontFamily: `"${b.font}", system-ui, sans-serif`,
    boxShadow: b.shadow === "soft" ? "0 4px 14px rgba(0,0,0,0.18)" : b.shadow === "hard" ? "4px 4px 0 rgba(0,0,0,0.85)" : "none",
  };
}
const delBtn: React.CSSProperties = { border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, flexShrink: 0 };
const addBtn: React.CSSProperties = { border: "1px dashed var(--border-2)", background: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "var(--text-3)", cursor: "pointer" };
