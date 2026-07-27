"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME, ANSWER_TYPE_ORDER, type AnswerTypeKey } from "@/lib/workflow/node-theme";
import { PortDot, HandoffIcon, HandoffPanel } from "./node-parts";

const ROW_LABEL: Record<AnswerTypeKey, string> = {
  text: "Text answer", image: "Image answer", video: "Video answer", link: "Link answer", file: "File answer",
};

/**
 * Question body (design): question textarea (64px block) + one 40px row per
 * answer type. Each enabled row exposes an output port; hovering a row reveals
 * its editor hand-off icon, which opens an inline hand-off panel beneath it.
 */
export function QuestionBody({ node }: { node: WorkflowNode; zoom: number }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const accent = NODE_THEME.question.accent;
  const answer = node.data.answer ?? { text: true, image: false, video: false, link: false, file: false };

  const hovered = useWorkflow((s) => s.hoveredHandoffKey);
  const setHovered = useWorkflow((s) => s.setHoveredHandoff);
  const openHandoff = useWorkflow((s) => s.openHandoff);

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
      <div style={{ padding: "0 0 8px" }}>
        {ANSWER_TYPE_ORDER.map((key) => {
          const on = !!answer[key];
          const optKey = `q_${key}`;
          const showIcon = hovered === optKey || (openHandoff?.nodeId === node.id && openHandoff.key === optKey);
          const panelOpen = openHandoff?.nodeId === node.id && openHandoff.key === optKey;
          return (
            <div key={key}>
              <div
                onMouseEnter={() => setHovered(optKey)}
                onMouseLeave={() => setHovered(null)}
                style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", position: "relative" }}
              >
                <Switch on={on} accent={accent} onToggle={() => updateNodeData(node.id, { answer: { ...answer, [key]: !on } })} />
                <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>{ROW_LABEL[key]}</span>
                {showIcon && <HandoffIcon nodeId={node.id} optionKey={optKey} />}
                {on && <PortDot node={node} portId={key} accent={accent} />}
              </div>
              {panelOpen && <HandoffPanel node={node} optionKey={optKey} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Switch({ on, accent, onToggle }: { on: boolean; accent: string; onToggle: () => void }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ width: 28, height: 16, borderRadius: 999, background: on ? accent : "var(--border-2)", position: "relative", flexShrink: 0, cursor: "pointer" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }} />
    </span>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%", height: "100%", boxSizing: "border-box", resize: "none",
  border: "1px solid var(--border-raw)", borderRadius: 10, padding: "8px 10px",
  fontFamily: "inherit", fontSize: 13, color: "var(--text)", outline: "none", background: "var(--surface)",
};
