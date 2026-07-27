"use client";

import * as React from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { useWorkflow, getHandoff, type WorkflowNode } from "@/lib/workflow/store";
import { outputPortPos, portIndex } from "@/lib/workflow/geometry";
import type { Attachment } from "@/lib/supabase/database.types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * Output port dot for a row. On mouse-down it starts a connection from this
 * node's port, seeding the pending line at the port's world position.
 */
export function PortDot({ node, portId, accent }: { node: WorkflowNode; portId: string; accent: string }) {
  const beginConnection = useWorkflow((s) => s.beginConnection);
  return (
    <span
      // Pointer (not mouse) events: the canvas ends drags on pointerup, and
      // preventDefault() here suppresses the compatibility mouse events, so a
      // mousedown-started drag could never be released. stopPropagation also
      // keeps the Start card's header (which hosts a PortDot) from dragging.
      onPointerDown={(e) => {
        if (e.button !== 0) return; // middle-click bubbles up → canvas pan
        e.stopPropagation();
        // Suppress the browser's native text-selection drag, which otherwise
        // highlights card copy while you pull a wire out.
        e.preventDefault();
        const idx = portIndex(node, portId);
        const p = idx >= 0 ? outputPortPos(node, idx) : { x: node.x, y: node.y };
        beginConnection(node.id, portId, p.x, p.y);
      }}
      title="Drag to an input to connect"
      style={{
        position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)",
        width: 28, height: 28, borderRadius: "50%",
        display: "grid", placeItems: "center", cursor: "crosshair", zIndex: 2,
        userSelect: "none", WebkitUserSelect: "none",
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: accent, border: "2px solid var(--surface)" }} />
    </span>
  );
}

/** The hover-revealed "glasses" hand-off toggle icon (drawn with two circles). */
export function HandoffIcon({ nodeId, optionKey }: { nodeId: string; optionKey: string }) {
  const toggleHandoff = useWorkflow((s) => s.toggleHandoff);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleHandoff(nodeId, optionKey); }}
      title="Editor hand-off"
      style={{
        width: 18, height: 18, border: "none", background: "none", padding: 0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <span style={{ position: "relative", width: 12, height: 10, display: "block" }}>
        <span style={{ position: "absolute", left: 0, top: 1, width: 7, height: 7, borderRadius: "50%", border: "1.3px solid var(--text-3)" }} />
        <span style={{ position: "absolute", right: 0, top: 1, width: 7, height: 7, borderRadius: "50%", border: "1.3px solid var(--text-3)" }} />
      </span>
    </button>
  );
}

/**
 * Inline per-option editor hand-off panel: effect name/value rows + a file
 * attachment. Rendered directly beneath the option row when open.
 */
export function HandoffPanel({ node, optionKey }: { node: WorkflowNode; optionKey: string }) {
  const addHandoffEffect = useWorkflow((s) => s.addHandoffEffect);
  const updateHandoffEffect = useWorkflow((s) => s.updateHandoffEffect);
  const removeHandoffEffect = useWorkflow((s) => s.removeHandoffEffect);
  const setHandoffAttachment = useWorkflow((s) => s.setHandoffAttachment);
  const projectId = useWorkflow((s) => s.project?.id ?? "");

  const handoff = getHandoff(node, optionKey);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputId = `${node.id}-${optionKey}-file`;

  async function onAttach(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind: Attachment["kind"] =
        ext === "cube" ? "lut" :
        ["lrtemplate", "xmp", "preset", "json", "prfpset", "prproj"].includes(ext) ? "preset" :
        file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("kind", kind);
      const res = await fetch("/api/workflows/uploads/bunny", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setHandoffAttachment(node.id, optionKey, {
        id: nanoid(8), name: json.name, url: json.url, kind: json.kind, size: json.size, provider: "bunny",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ margin: "0 12px 8px", padding: 10, border: "1px solid var(--border-raw)", borderRadius: 10, background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
        Editor hand-off
      </div>
      {handoff.effects.map((fx) => (
        <div key={fx.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={fx.label}
            onChange={(e) => updateHandoffEffect(node.id, optionKey, fx.id, { label: e.target.value })}
            placeholder="Effect (e.g. Grain)"
            style={effectInput}
          />
          <input
            value={fx.value}
            onChange={(e) => updateHandoffEffect(node.id, optionKey, fx.id, { value: e.target.value })}
            placeholder="Value (e.g. 12%)"
            style={effectInput}
          />
          <button onClick={() => removeHandoffEffect(node.id, optionKey, fx.id)} style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <button
        onClick={() => addHandoffEffect(node.id, optionKey)}
        style={{ alignSelf: "flex-start", border: "1px dashed var(--border-2)", background: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "var(--text-3)", cursor: "pointer" }}
      >
        + Add setting
      </button>
      <div style={{ borderTop: "1px dashed var(--border-raw)", paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={fileRef} type="file" id={inputId} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }} />
        <label htmlFor={inputId} style={{ border: "1px dashed var(--border-2)", borderRadius: 6, padding: "5px 9px", fontSize: 10, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap" }}>
          {uploading ? "Uploading…" : "+ Attach LUT / reference"}
        </label>
        <span style={{ fontSize: 10, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {handoff.attachment?.name ?? "No file attached"}
        </span>
      </div>
    </div>
  );
}

const effectInput: React.CSSProperties = {
  flex: 1, minWidth: 0, boxSizing: "border-box",
  border: "1px solid var(--border-raw)", borderRadius: 6, padding: "5px 7px", fontSize: 11,
  background: "var(--surface)", color: "var(--text)", outline: "none",
};

export { MONO };
