"use client";

import * as React from "react";
import { toast } from "sonner";
import { useWorkflow, type PlacementLayerPatch } from "@/lib/workflow/store";
import {
  BLEND_MODES, DEFAULT_TRANSFORM, FONT_WEIGHTS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB,
} from "@/lib/workflow/placement";
import { GoogleFontsPicker } from "../google-fonts-picker";
import type {
  PlacementImageLayer, PlacementTextLayer, PlacementTransform,
} from "@/lib/supabase/database.types";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * In-card tools for the selected Placement overlay. Text and image layers get
 * their own panel; both write through `updatePlacementLayer`. Every numeric
 * control is in RELATIVE units (see lib/workflow/placement.ts) so the card
 * preview and the client's screen stay in lockstep.
 */
export function TextLayerTools({
  nodeId, tabId, layer,
}: {
  nodeId: string;
  tabId: string;
  layer: PlacementTextLayer;
}) {
  const update = useWorkflow((s) => s.updatePlacementLayer);
  const set = (patch: PlacementLayerPatch) => update(nodeId, tabId, layer.id, patch);

  return (
    <Panel>
      <input
        value={layer.text}
        onChange={(e) => set({ text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Caption text…"
        style={textInput}
      />

      <Field label="Font">
        <GoogleFontsPicker
          value={layer.font}
          language={layer.lang}
          onChange={(family, subset) => set({ font: family, lang: subset })}
        />
      </Field>

      <Two>
        <Field label="Weight">
          <Select
            value={String(layer.weight)}
            onChange={(v) => set({ weight: Number(v) })}
            options={FONT_WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))}
          />
        </Field>
        <Field label="Color">
          <ColorInput value={layer.color} onChange={(v) => set({ color: v })} />
        </Field>
      </Two>

      <Slider label="Size" value={layer.size} min={1} max={40} step={0.5} suffix="%" onChange={(v) => set({ size: v })} />

      <Two>
        <Field label="X position">
          <ScrubInput value={layer.x} onChange={(v) => set({ x: v })} />
        </Field>
        <Field label="Y position">
          <ScrubInput value={layer.y} onChange={(v) => set({ y: v })} />
        </Field>
      </Two>

      {/* Box size. Absent until the corner handles are dragged — an auto box
          hugs its text, so there's nothing to show until it's been pinned. */}
      {layer.boxW != null || layer.boxH != null ? (
        <>
          <Two>
            <Field label="Width">
              <ScrubInput value={layer.boxW ?? 0} min={4} max={200} onChange={(v) => set({ boxW: v })} />
            </Field>
            <Field label="Height">
              <ScrubInput value={layer.boxH ?? 0} min={3} max={200} onChange={(v) => set({ boxH: v })} />
            </Field>
          </Two>
          <button
            onClick={(e) => { e.stopPropagation(); set({ boxW: undefined, boxH: undefined }); }}
            style={{ alignSelf: "flex-start", border: "none", background: "none", color: "var(--text-3)", fontSize: 10, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            fit box to text
          </button>
        </>
      ) : (
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>
          Drag the four corner dots on the preview to size the text box.
        </span>
      )}

      {/* Text plate */}
      <Group
        title="Background"
        on={layer.bg.on}
        onToggle={() => set({ bg: { ...layer.bg, on: !layer.bg.on } })}
      >
        <Two>
          <Field label="Color">
            <ColorInput value={layer.bg.color} onChange={(v) => set({ bg: { ...layer.bg, color: v } })} />
          </Field>
          <Field label={`Roundness — ${layer.bg.radius}`}>
            <input
              type="range" min={0} max={100} value={layer.bg.radius}
              onChange={(e) => set({ bg: { ...layer.bg, radius: Number(e.target.value) } })}
              style={range}
            />
          </Field>
        </Two>
      </Group>

      {/* Drop shadow */}
      <Group
        title="Shadow"
        on={layer.shadow.on}
        onToggle={() => set({ shadow: { ...layer.shadow, on: !layer.shadow.on } })}
      >
        <Field label="Color">
          <ColorInput value={layer.shadow.color} onChange={(v) => set({ shadow: { ...layer.shadow, color: v } })} />
        </Field>
        <Slider label="Offset X" value={layer.shadow.x} min={-60} max={60} step={1} onChange={(v) => set({ shadow: { ...layer.shadow, x: v } })} />
        <Slider label="Offset Y" value={layer.shadow.y} min={-60} max={60} step={1} onChange={(v) => set({ shadow: { ...layer.shadow, y: v } })} />
        <Slider label="Blur" value={layer.shadow.blur} min={0} max={150} step={1} onChange={(v) => set({ shadow: { ...layer.shadow, blur: v } })} />
      </Group>
    </Panel>
  );
}

export function ImageLayerTools({
  nodeId, tabId, layer,
}: {
  nodeId: string;
  tabId: string;
  layer: PlacementImageLayer;
}) {
  const update = useWorkflow((s) => s.updatePlacementLayer);
  const projectId = useWorkflow((s) => s.project?.id ?? "");
  const set = (patch: PlacementLayerPatch) => update(nodeId, tabId, layer.id, patch);

  const [uploading, setUploading] = React.useState(false);
  const inputId = `${nodeId}-${layer.id}-overlay`;

  async function replace(file: File) {
    setUploading(true);
    try {
      const { url, name } = await uploadPlacementFile(file, projectId, "image");
      set({ url, name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) replace(f); e.target.value = ""; }}
        />
        <label htmlFor={inputId} style={ghostBtn}>{uploading ? "Uploading…" : "Replace image"}</label>
        <span style={{ fontSize: 10.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {layer.name || "Untitled"}
        </span>
      </div>

      <Slider label="Scale" value={layer.scale} min={1} max={120} step={0.5} suffix="%" onChange={(v) => set({ scale: v })} />

      <Two>
        <Field label="X position">
          <ScrubInput value={layer.x} onChange={(v) => set({ x: v })} />
        </Field>
        <Field label="Y position">
          <ScrubInput value={layer.y} onChange={(v) => set({ y: v })} />
        </Field>
      </Two>

      <Slider label="Rotation" value={layer.rotation} min={-180} max={180} step={1} suffix="°" onChange={(v) => set({ rotation: v })} />

      <Two>
        <Field label="Blend mode">
          <Select
            value={layer.blend}
            onChange={(v) => set({ blend: v as PlacementImageLayer["blend"] })}
            options={BLEND_MODES.map((m) => ({ value: m, label: m }))}
          />
        </Field>
        <Field label={`Opacity — ${layer.opacity}%`}>
          <input
            type="range" min={0} max={100} value={layer.opacity}
            onChange={(e) => set({ opacity: Number(e.target.value) })}
            style={range}
          />
        </Field>
      </Two>
    </Panel>
  );
}

/**
 * Framing tools for the tab's background media. Scale 100 = fills the frame
 * (the media is object-fit: cover), so zooming past 100 crops in and below 100
 * pulls away from the edges — the same relative units the overlays use.
 */
export function BackgroundTools({
  nodeId, tabId, transform,
}: {
  nodeId: string;
  tabId: string;
  transform: PlacementTransform;
}) {
  const updateTab = useWorkflow((s) => s.updatePlacementTab);
  const set = (patch: Partial<PlacementTransform>) =>
    updateTab(nodeId, tabId, { transform: { ...transform, ...patch } });
  const dirty =
    transform.scale !== DEFAULT_TRANSFORM.scale || transform.x !== DEFAULT_TRANSFORM.x ||
    transform.y !== DEFAULT_TRANSFORM.y || transform.rotation !== DEFAULT_TRANSFORM.rotation;

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={labelStyle}>Frame</span>
        {dirty && (
          <button
            onClick={(e) => { e.stopPropagation(); updateTab(nodeId, tabId, { transform: { ...DEFAULT_TRANSFORM } }); }}
            style={{ border: "none", background: "none", color: "var(--text-3)", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}
          >
            reset
          </button>
        )}
      </div>
      <Slider label="Scale" value={transform.scale} min={20} max={300} step={1} suffix="%" onChange={(v) => set({ scale: v })} />
      {/* Backgrounds get a wider travel than overlays — you often push a frame
          well past its edge when zoomed in. */}
      <Two>
        <Field label="X offset">
          <ScrubInput value={transform.x} min={-150} max={150} onChange={(v) => set({ x: v })} />
        </Field>
        <Field label="Y offset">
          <ScrubInput value={transform.y} min={-150} max={150} onChange={(v) => set({ y: v })} />
        </Field>
      </Two>
      <Slider label="Rotation" value={transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(v) => set({ rotation: v })} />
    </Panel>
  );
}

/**
 * Upload a placement asset (base media or overlay image) to Bunny through the
 * workflows-scoped route, which validates ownership against workflow_projects.
 *
 * The response is read as TEXT first and parsed by hand: anything that isn't our
 * route — a proxy's 413, a dev server with a stale route manifest — answers with
 * an HTML page, and `res.json()` on that just reports `Unexpected token '<'`,
 * which says nothing about what actually went wrong.
 */
interface UploadResponse {
  url?: string;
  name?: string;
  error?: string;
}

export async function uploadPlacementFile(
  file: File,
  projectId: string,
  kind: "image" | "video",
): Promise<{ url: string; name: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${kind === "video" ? "Video" : "Image"} is too large — max ${MAX_UPLOAD_MB} MB`);
  }
  if (!projectId) throw new Error("Save the workflow before uploading media");

  const form = new FormData();
  form.append("file", file);
  form.append("projectId", projectId);
  form.append("kind", kind);

  const res = await fetch("/api/workflows/uploads/bunny", { method: "POST", body: form });
  const body = await res.text();

  let json: UploadResponse | null = null;
  try {
    json = JSON.parse(body) as UploadResponse;
  } catch {
    // Not our route's JSON — surface the status and a snippet instead.
    const hint = res.status === 413 ? "the file is too large for the server" : "the server returned an error page";
    throw new Error(`Upload failed (HTTP ${res.status}) — ${hint}. Restart the dev server if this persists.`);
  }

  if (!res.ok) throw new Error(json?.error ?? `Upload failed (HTTP ${res.status})`);
  if (!json?.url) throw new Error("Upload succeeded but returned no URL");
  return { url: json.url, name: json.name ?? file.name };
}

// ─────────────────────────── small controls ───────────────────────────
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 10,
        border: "1px solid var(--border-raw)", borderRadius: 10, background: "var(--surface-2)",
      }}
    >
      {children}
    </div>
  );
}

function Two({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Group({
  title, on, onToggle, children,
}: {
  title: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px dashed var(--border-raw)", paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={labelStyle}>{title}</span>
        <Toggle on={on} onToggle={onToggle} />
      </div>
      {on && children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 26, height: 15, borderRadius: 999, position: "relative", cursor: "pointer", flexShrink: 0,
        background: on ? "var(--accent)" : "var(--border-2)",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 11, height: 11, borderRadius: "50%", background: "#fff" }} />
    </span>
  );
}

function Slider({
  label, value, min, max, step, suffix, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={labelStyle}>
        {label} — {value}
        {suffix ?? ""}
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={range}
      />
    </div>
  );
}

/**
 * Position field you scrub: drag left/right on the value to change it (Shift =
 * fine), single-click to type an exact number. Pointer events throughout and
 * the drag ends on `window` — a pointerdown that calls preventDefault() never
 * produces the compatibility mouse events, so a mouseup listener would never
 * fire and the scrub would stick to the cursor.
 */
function ScrubInput({
  value, onChange, min = -25, max = 125, perPx = 0.25, suffix = "%",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Units changed per pixel of horizontal travel. */
  perPx?: number;
  suffix?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [hover, setHover] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault(); // no text-selection drag across the card
    e.stopPropagation();
    const startX = e.clientX;
    const startValue = value;
    let dragged = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      // A few px of slop so a slightly shaky click still counts as a click.
      if (!dragged && Math.abs(dx) < 3) return;
      dragged = true;
      const step = ev.shiftKey ? perPx * 0.2 : perPx;
      onChange(clampRound(startValue + dx * step, min, max));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragged) {
        setText(String(value));
        setEditing(true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function commit() {
    const v = Number(text);
    if (Number.isFinite(v)) onChange(clampRound(v, min, max));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        style={{ ...scrubBox, cursor: "text", borderColor: "var(--accent)" }}
      />
    );
  }

  return (
    <span
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag left / right to change — click to type"
      style={{
        ...scrubBox,
        cursor: "ew-resize",
        userSelect: "none",
        WebkitUserSelect: "none",
        borderColor: hover ? "var(--accent)" : "var(--border-raw)",
        display: "block",
      }}
    >
      {value}
      {suffix}
    </span>
  );
}

const clampRound = (v: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;

const scrubBox: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid var(--border-raw)", borderRadius: 7,
  padding: "5px 7px", fontSize: 11.5, lineHeight: "16px", background: "var(--surface)",
  color: "var(--text)", outline: "none", fontFamily: "inherit",
};

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border-raw)", borderRadius: 7, padding: "3px 6px", background: "var(--surface)" }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 22, height: 20, border: "none", padding: 0, background: "none", cursor: "pointer" }}
      />
      <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>{value}</span>
    </span>
  );
}

function Select({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box", border: "1px solid var(--border-raw)", borderRadius: 7,
        padding: "5px 6px", fontSize: 11.5, background: "var(--surface)", color: "var(--text)", outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "var(--text-3)",
};
const range: React.CSSProperties = { width: "100%", accentColor: "var(--accent)" };
const textInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid var(--border-raw)", borderRadius: 8,
  padding: "6px 8px", fontSize: 12, fontFamily: "inherit", background: "var(--surface)",
  color: "var(--text)", outline: "none",
};
const ghostBtn: React.CSSProperties = {
  border: "1px dashed var(--border-2)", borderRadius: 7, padding: "5px 9px",
  fontSize: 10.5, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};
