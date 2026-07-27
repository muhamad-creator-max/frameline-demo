"use client";

import * as React from "react";
import { useWorkflow, outputPorts, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { activeTab, getPlacement, RESPOND_LABEL } from "@/lib/workflow/placement";
import { PlacementStage } from "./placement-stage";
import type { IdentityBox } from "@/lib/supabase/database.types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * In-editor Live Preview modal (design): simulates the client-facing flow using
 * the current canvas state. Starts from the node with no incoming edge, renders
 * a type-appropriate step, and advances by the chosen output port index until a
 * dead end → "Complete".
 */
export function PreviewModal({ onClose }: { onClose: () => void }) {
  const nodes = useWorkflow((s) => s.nodes);
  const edges = useWorkflow((s) => s.edges);

  const startId = React.useMemo(() => {
    const start = nodes.find((n) => n.kind === "start");
    if (start) {
      const e = edges.find((x) => x.source_node_id === start.id);
      if (e) return e.target_node_id;
    }
    // else first node with no incoming edge that isn't a Start
    const withIncoming = new Set(edges.map((e) => e.target_node_id));
    return nodes.find((n) => n.kind !== "start" && !withIncoming.has(n.id))?.id ?? null;
  }, [nodes, edges]);

  const [currentId, setCurrentId] = React.useState<string | null>(startId);
  const [done, setDone] = React.useState(false);
  const [textVal, setTextVal] = React.useState("");

  const node = currentId ? nodes.find((n) => n.id === currentId) ?? null : null;

  function advance(portIndex: number) {
    if (!node) { setDone(true); return; }
    const port = outputPorts(node)[portIndex];
    const edge = port ? edges.find((e) => e.source_node_id === node.id && e.source_port === port.id) : undefined;
    setTextVal("");
    if (edge && nodes.some((n) => n.id === edge.target_node_id)) setCurrentId(edge.target_node_id);
    else setDone(true);
  }

  const accent = node ? NODE_THEME[node.kind].accent : "var(--accent)";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(24,24,27,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: "90vw", background: "var(--surface)", borderRadius: 20, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative" }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, border: "none", background: "none", fontSize: 18, color: "var(--text-3)", cursor: "pointer" }}>×</button>

        {done || !node ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: NODE_THEME.note.accent, marginBottom: 10 }}>Complete</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>Thanks! Your responses were recorded.</div>
          </div>
        ) : node.kind === "note" ? (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 18 }}>{node.data.text}</div>
            <ContinueBtn onClick={() => advance(0)} />
          </>
        ) : node.kind === "choice" ? (
          <>
            <Eyebrow accent={accent}>Choice</Eyebrow>
            <Title>{node.data.title}</Title>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(node.data.choices ?? []).map((c, i) => (
                <button key={c.id} onClick={() => advance(i)} style={optionBtn}>{c.label || "Choice"}</button>
              ))}
            </div>
          </>
        ) : node.kind === "placement" ? (
          <PlacementStep node={node} accent={accent} onContinue={() => advance(0)} />
        ) : node.kind === "identity" ? (
          <>
            <Eyebrow accent={accent}>Pick one</Eyebrow>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(node.data.boxes ?? []).map((b, i) => (
                <button key={b.id} onClick={() => advance(i)} style={identityBtn(b)}>{b.text || "Box"}</button>
              ))}
            </div>
          </>
        ) : (
          // question
          <>
            <Eyebrow accent={accent}>Question</Eyebrow>
            <Title>{node.data.title}</Title>
            <input
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              placeholder={questionHint(node.data.answer)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border-raw)", borderRadius: 12, padding: "12px 14px", fontSize: 14, marginBottom: 18, outline: "none", background: "var(--surface)", color: "var(--text)" }}
            />
            <ContinueBtn onClick={() => advance(0)} />
          </>
        )}
      </div>
    </div>
  );
}

/** Placement step: option tabs (as the client sees them) over the composite. */
function PlacementStep({
  node, accent, onContinue,
}: {
  node: WorkflowNode;
  accent: string;
  onContinue: () => void;
}) {
  const placement = getPlacement(node.data);
  const [pick, setPick] = React.useState(placement.tabs[0]?.id ?? null);
  const tab = activeTab(placement, pick);

  return (
    <>
      <Eyebrow accent={accent}>Placement</Eyebrow>
      <Title>{node.data.title}</Title>
      {placement.tabs.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {placement.tabs.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setPick(t.id)}
              style={{
                padding: "5px 11px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                border: `1px solid ${t.id === pick ? "transparent" : "var(--border-raw)"}`,
                background: t.id === pick ? accent : "var(--surface)",
                color: t.id === pick ? "#fff" : "var(--text-2)",
              }}
            >
              {t.name || `Option ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <PlacementStage tab={tab} aspect={placement.aspect} radius={12} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
        Client responds with: {RESPOND_LABEL[placement.respond]}
      </div>
      <ContinueBtn onClick={onContinue} />
    </>
  );
}

function questionHint(a: { text?: boolean; image?: boolean; video?: boolean; link?: boolean; file?: boolean } | undefined): string {
  if (a?.text) return "Text answer";
  if (a?.image) return "Image upload";
  if (a?.video) return "Video upload";
  if (a?.link) return "Link";
  if (a?.file) return "File upload";
  return "Text answer";
}

function Eyebrow({ accent, children }: { accent: string; children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: accent, marginBottom: 14 }}>{children}</div>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 16, lineHeight: 1.4, color: "var(--text)" }}>{children || "Untitled question"}</div>;
}
function ContinueBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: 12, border: "none", borderRadius: 12, background: "var(--text)", color: "var(--bg)", fontFamily: MONO, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>Continue</button>
  );
}

const optionBtn: React.CSSProperties = {
  textAlign: "left", padding: "12px 14px", border: "1px solid var(--border-raw)", borderRadius: 12,
  background: "var(--surface)", fontSize: 14, cursor: "pointer", color: "var(--text)",
};
function identityBtn(b: IdentityBox): React.CSSProperties {
  return {
    background: b.bg, color: b.color, borderRadius: b.radius, border: "none",
    padding: "14px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: `"${b.font}", system-ui, sans-serif`,
  };
}
