"use client";

import * as React from "react";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import { getPlacement } from "@/lib/workflow/placement";
import { GoogleFontsPicker } from "../google-fonts-picker";
import type { IdentityBox, PlacementRespondType } from "@/lib/supabase/database.types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

// ─────────────────────────── Question ───────────────────────────
export function QuestionSettings({ node }: { node: WorkflowNode }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const required = !!node.data.required;
  const accent = NODE_THEME.question.accent;
  return (
    <>
      <Row label="Required">
        <Switch on={required} accent={accent} onToggle={() => updateNodeData(node.id, { required: !required })} />
      </Row>
      <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
        Toggle answer types directly in the node body above — each enabled type creates its own output branch.
      </p>
    </>
  );
}

// ─────────────────────────── Choice ───────────────────────────
export function ChoiceSettings({ node }: { node: WorkflowNode }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  return (
    <Row label="Maximum answers">
      <NumberInput value={node.data.max_answers ?? 1} min={1} onChange={(v) => updateNodeData(node.id, { max_answers: v })} />
    </Row>
  );
}

// ─────────────────────────── Identity ───────────────────────────
export function IdentitySettings({ node }: { node: WorkflowNode }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const boxes = node.data.boxes ?? [];
  return (
    <>
      <Row label="Maximum answers">
        <NumberInput value={node.data.max_answers ?? 1} min={1} onChange={(v) => updateNodeData(node.id, { max_answers: v })} />
      </Row>
      {boxes.map((b) => (
        <BoxSettings key={b.id} nodeId={node.id} box={b} />
      ))}
    </>
  );
}

const SWATCHES = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#d97706"];

function BoxSettings({ nodeId, box }: { nodeId: string; box: IdentityBox }) {
  const updateBox = useWorkflow((s) => s.updateBox);
  const set = (patch: Partial<IdentityBox>) => updateBox(nodeId, box.id, patch);

  return (
    <div style={{ border: "1px solid var(--border-raw)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "var(--surface)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>{box.text || "Box"}</div>

      {/* Background swatches + custom */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {SWATCHES.map((c) => (
          <span
            key={c}
            onClick={() => set({ bg: c })}
            style={{ width: 20, height: 20, borderRadius: 6, background: c, cursor: "pointer", border: box.bg === c ? "2px solid var(--text)" : "2px solid transparent" }}
          />
        ))}
        <input type="color" value={box.bg} onChange={(e) => set({ bg: e.target.value })} style={{ width: 24, height: 24, border: "none", padding: 0, background: "none" }} />
      </div>

      {/* Text color + text bg */}
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ fontSize: 11, color: "var(--text-3)", flex: 1 }}>
          Text color
          <input type="color" value={box.color} onChange={(e) => set({ color: e.target.value })} style={{ width: "100%", height: 24, border: "none" }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--text-3)", flex: 1 }}>
          Text bg
          <input type="color" value={box.textBg === "transparent" ? "#ffffff" : box.textBg} onChange={(e) => set({ textBg: e.target.value })} style={{ width: "100%", height: 24, border: "none" }} />
        </label>
      </div>

      {/* Radius */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Radius — {box.radius}px</div>
        <input type="range" min={0} max={40} value={box.radius} onChange={(e) => set({ radius: parseInt(e.target.value, 10) })} style={{ width: "100%" }} />
      </div>

      {/* Shadow segmented */}
      <div style={{ display: "flex", gap: 6 }}>
        {(["none", "soft", "hard"] as const).map((s) => (
          <button key={s} onClick={() => set({ shadow: s })} style={shadowBtn(box.shadow === s)}>{s}</button>
        ))}
      </div>

      {/* Font picker (reuses the searchable Google-fonts picker) */}
      <GoogleFontsPicker value={box.font} language={box.lang} onChange={(family, subset) => set({ font: family, lang: subset })} />
    </div>
  );
}

// ─────────────────────────── Placement ───────────────────────────
const RESPOND_TYPES: { id: PlacementRespondType; label: string; hint: string }[] = [
  { id: "text", label: "Text", hint: "The client types their reaction to the placement." },
  { id: "media", label: "Media", hint: "The client uploads an image or video back." },
  { id: "link", label: "Link", hint: "The client pastes a URL (Figma, Drive, reference…)." },
];

export function PlacementSettings({ node }: { node: WorkflowNode }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const updatePlacement = useWorkflow((s) => s.updatePlacement);
  const placement = getPlacement(node.data);
  const accent = NODE_THEME.placement.accent;
  const active = RESPOND_TYPES.find((r) => r.id === placement.respond) ?? RESPOND_TYPES[0];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>Respond type</span>
        <div style={{ display: "flex", gap: 6 }}>
          {RESPOND_TYPES.map((r) => (
            <button
              key={r.id}
              onClick={(e) => { e.stopPropagation(); updatePlacement(node.id, { respond: r.id }); }}
              style={segBtn(placement.respond === r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{active.hint}</p>
      </div>
      <Row label="Required">
        <Switch
          on={!!node.data.required}
          accent={accent}
          onToggle={() => updateNodeData(node.id, { required: !node.data.required })}
        />
      </Row>
    </>
  );
}

// ─────────────────────────── Note ───────────────────────────
export function NoteSettings() {
  return <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>This tool doesn&apos;t have additional settings.</div>;
}

// ─────────────────────────── shared ───────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, min, onChange }: { value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(e) => {
        let v = parseInt(e.target.value || String(min ?? 0), 10);
        if (Number.isNaN(v)) v = min ?? 0;
        if (min != null) v = Math.max(min, v);
        onChange(v);
      }}
      style={{ width: 56, border: "1px solid var(--border-raw)", borderRadius: 8, padding: "4px 6px", fontSize: 12, textAlign: "center", background: "var(--surface)", color: "var(--text)" }}
    />
  );
}

function Switch({ on, accent, onToggle }: { on: boolean; accent: string; onToggle: () => void }) {
  return (
    <span onClick={onToggle} style={{ width: 28, height: 16, borderRadius: 999, background: on ? accent : "var(--border-2)", position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff" }} />
    </span>
  );
}

/** Segmented-control button (respond type). Same visual family as shadowBtn. */
function segBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "6px 0", borderRadius: 7, border: `1px solid ${active ? "var(--text)" : "var(--border-raw)"}`,
    background: active ? "var(--text)" : "var(--surface)", color: active ? "var(--bg)" : "var(--text-3)",
    fontSize: 11, cursor: "pointer", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.03em",
  };
}

function shadowBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${active ? "var(--text)" : "var(--border-raw)"}`,
    background: active ? "var(--text)" : "var(--surface)", color: active ? "var(--bg)" : "var(--text-3)",
    fontSize: 10, cursor: "pointer", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.03em",
  };
}
