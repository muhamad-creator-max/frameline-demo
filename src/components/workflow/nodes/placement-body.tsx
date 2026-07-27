"use client";

import * as React from "react";
import { toast } from "sonner";
import { useWorkflow, type WorkflowNode } from "@/lib/workflow/store";
import { NODE_THEME } from "@/lib/workflow/node-theme";
import {
  ASPECT_PRESETS,
  PLACEMENT_CARD_W,
  PLACEMENT_PAD,
  PLACEMENT_TABS_H,
  PLACEMENT_TITLE_H,
  activeTab,
  getPlacement,
  getTransform,
  layerLabel,
  stageSize,
} from "@/lib/workflow/placement";
import { PlacementStage, type ResizeStart } from "../placement-stage";
import { PortDot, HandoffIcon, HandoffPanel } from "./node-parts";
import {
  BackgroundTools, ImageLayerTools, TextLayerTools, uploadPlacementFile,
} from "./placement-tools";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
/** Hand-off key for the node's single output (see store's option_handoffs). */
const OPT_KEY = "placement";

/**
 * Placement body: a prompt, one tab per option the client will choose between,
 * a live composite preview of the active tab, and the tools for the selected
 * overlay.
 *
 * The stage spans the card's full inner width and its height just follows the
 * ratio — a 9:16 option makes the card taller rather than shrinking the preview.
 * geometry.ts derives the output port's Y from the same `stageSize`, so the wire
 * always meets the dot; if you change the title/tab-strip heights, change
 * placement.ts's constants with them.
 */
export function PlacementBody({ node, zoom }: { node: WorkflowNode; zoom: number }) {
  const updateNodeData = useWorkflow((s) => s.updateNodeData);
  const updatePlacement = useWorkflow((s) => s.updatePlacement);
  const updateTab = useWorkflow((s) => s.updatePlacementTab);
  const addTab = useWorkflow((s) => s.addPlacementTab);
  const removeTab = useWorkflow((s) => s.removePlacementTab);
  const setActiveTab = useWorkflow((s) => s.setActiveTab);
  const addLayer = useWorkflow((s) => s.addPlacementLayer);
  const updateLayer = useWorkflow((s) => s.updatePlacementLayer);
  const removeLayer = useWorkflow((s) => s.removePlacementLayer);
  const setSelectedLayer = useWorkflow((s) => s.setSelectedLayer);
  const selectedLayerId = useWorkflow((s) => s.selectedLayerId);
  const activeTabId = useWorkflow((s) => s.activeTabId);
  const projectId = useWorkflow((s) => s.project?.id ?? "");
  const accent = NODE_THEME.placement.accent;

  const hovered = useWorkflow((s) => s.hoveredHandoffKey);
  const setHovered = useWorkflow((s) => s.setHoveredHandoff);
  const openHandoff = useWorkflow((s) => s.openHandoff);

  const [busy, setBusy] = React.useState<null | "media" | "overlay">(null);
  const mediaInputId = `${node.id}-placement-media`;
  const overlayInputId = `${node.id}-placement-overlay`;

  const placement = getPlacement(node.data);
  const tab = activeTab(placement, activeTabId);
  const stage = stageSize(placement.aspect, PLACEMENT_CARD_W - PLACEMENT_PAD * 2);
  const selected = tab.layers.find((l) => l.id === selectedLayerId) ?? null;

  const showIcon = hovered === OPT_KEY || (openHandoff?.nodeId === node.id && openHandoff.key === OPT_KEY);
  const panelOpen = openHandoff?.nodeId === node.id && openHandoff.key === OPT_KEY;

  /** Drag an overlay around the preview. Pointer events only (see canvas notes). */
  function onLayerPointerDown(layerId: string, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault(); // kill the native image/text drag
    setSelectedLayer(layerId);
    const layer = tab.layers.find((l) => l.id === layerId);
    if (!layer) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = layer.x;
    const originY = layer.y;

    const move = (ev: PointerEvent) => {
      // Screen px → world px (the card is inside the zoomed canvas layer) → %.
      const dx = ((ev.clientX - startX) / zoom / stage.w) * 100;
      const dy = ((ev.clientY - startY) / zoom / stage.h) * 100;
      updateLayer(node.id, tab.id, layerId, {
        x: round1(clamp(originX + dx, -25, 125)),
        y: round1(clamp(originY + dy, -25, 125)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /**
   * Corner-handle resize of a text box. Free (width and height move
   * independently) and anchored: the corner opposite the one you grabbed stays
   * put, so the centre shifts by half the delta. Rotation isn't compensated —
   * text layers have no rotation control today.
   */
  const onLayerResize: ResizeStart = (layerId, corner, e, size) => {
    if (e.button !== 0) return;
    const layer = tab.layers.find((l) => l.id === layerId);
    if (!layer || layer.type !== "text") return;

    const startX = e.clientX;
    const startY = e.clientY;
    const w0 = layer.boxW ?? size.w;
    const h0 = layer.boxH ?? size.h;
    const x0 = layer.x;
    const y0 = layer.y;
    const east = corner === "ne" || corner === "se";
    const south = corner === "se" || corner === "sw";

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / zoom / stage.w) * 100;
      const dy = ((ev.clientY - startY) / zoom / stage.h) * 100;
      const w = clamp(east ? w0 + dx : w0 - dx, MIN_BOX_W, 200);
      const h = clamp(south ? h0 + dy : h0 - dy, MIN_BOX_H, 200);
      updateLayer(node.id, tab.id, layerId, {
        boxW: round1(w),
        boxH: round1(h),
        // Half the delta keeps the grabbed corner under the cursor and the
        // opposite one pinned (the box is centred on x/y).
        x: round1(x0 + dx / 2),
        y: round1(y0 + dy / 2),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** Background media for THIS tab; the frame ratio follows the file's own. */
  async function onPickMedia(file: File) {
    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    setBusy("media");
    try {
      const size = await measureMedia(file, kind);
      const { url, name } = await uploadPlacementFile(file, projectId, kind);
      updateTab(node.id, tab.id, {
        media: { url, kind, name, width: size?.w, height: size?.h, provider: "bunny" },
      });
      if (size && size.h > 0) updatePlacement(node.id, { aspect: size.w / size.h });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPickOverlay(file: File) {
    setBusy("overlay");
    try {
      const { url, name } = await uploadPlacementFile(file, projectId, "image");
      addLayer(node.id, tab.id, "image", url, name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* Prompt shown to the client above the options. */}
      <div style={{ height: PLACEMENT_TITLE_H, boxSizing: "border-box", padding: "8px 12px 6px" }}>
        <input
          value={node.data.title ?? ""}
          onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="What should the client compare?"
          style={promptInput}
        />
      </div>

      {/* Option tabs. Each tab is one option the client picks between; Duplicate
          clones the current setup so you can tweak a variant of it. */}
      <div
        style={{
          height: PLACEMENT_TABS_H, boxSizing: "border-box", padding: "0 12px",
          display: "flex", alignItems: "center", gap: 4, overflowX: "auto",
        }}
      >
        {placement.tabs.map((t) => {
          const isActive = t.id === tab.id;
          return (
            <span
              key={t.id}
              onPointerDown={(e) => { e.stopPropagation(); if (!isActive) setActiveTab(t.id); }}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${isActive ? accent : "var(--border-raw)"}`,
                background: isActive ? `color-mix(in srgb, ${accent} 12%, transparent)` : "var(--surface)",
              }}
            >
              <input
                value={t.name}
                onChange={(e) => updateTab(node.id, t.id, { name: e.target.value })}
                // Clicking the label must still switch tabs — stopping here
                // would swallow the parent's activation handler.
                onPointerDown={(e) => { e.stopPropagation(); if (!isActive) setActiveTab(t.id); }}
                size={Math.max(6, t.name.length)}
                style={{
                  border: "none", background: "transparent", outline: "none", padding: 0,
                  fontSize: 11, color: isActive ? "var(--text)" : "var(--text-2)",
                  fontWeight: isActive ? 600 : 400, width: `${Math.max(6, t.name.length) * 6.2}px`,
                }}
              />
              {placement.tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeTab(node.id, t.id); }}
                  style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
                  aria-label="Remove option"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        <button
          onClick={(e) => { e.stopPropagation(); addTab(node.id); }}
          title="Add a blank option"
          style={{ ...tabBtn, flexShrink: 0 }}
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); addTab(node.id, tab.id); }}
          title="Copy this option — media and overlays — into a new tab"
          style={{ ...tabBtn, width: "auto", padding: "0 8px", gap: 4, flexShrink: 0 }}
        >
          ⧉ <span style={{ fontSize: 10 }}>Duplicate</span>
        </button>
      </div>

      {/* Preview stage. Height is authoritative for port geometry — don't pad it. */}
      <div
        onMouseEnter={() => setHovered(OPT_KEY)}
        onMouseLeave={() => setHovered(null)}
        style={{
          height: stage.h, padding: `0 ${PLACEMENT_PAD}px`, boxSizing: "border-box",
          position: "relative",
        }}
      >
        <PlacementStage
          tab={tab}
          aspect={placement.aspect}
          width={stage.w}
          selectedLayerId={selectedLayerId}
          onLayerPointerDown={onLayerPointerDown}
          onLayerResize={onLayerResize}
          emptyHint="Pick a background below to place captions on"
        />
        {showIcon && (
          <span style={{ position: "absolute", top: 6, right: 20, background: "var(--surface)", borderRadius: 4, zIndex: 3 }}>
            <HandoffIcon nodeId={node.id} optionKey={OPT_KEY} />
          </span>
        )}
        <PortDot node={node} portId="out" accent={accent} />
      </div>

      {panelOpen && <HandoffPanel node={node} optionKey={OPT_KEY} />}

      {/* ── Background: the media this option sits on ── */}
      <Section label="Background">
        <input
          id={mediaInputId}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickMedia(f); e.target.value = ""; }}
        />
        <label htmlFor={mediaInputId} style={{ ...toolBtn, borderStyle: "dashed" }}>
          {busy === "media" ? "Uploading…" : tab.media ? "Replace" : "+ Image / Video"}
        </label>
        {tab.media && (
          <>
            <span style={{ fontSize: 10.5, color: "var(--text-3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tab.media.name || tab.media.kind}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); updateTab(node.id, tab.id, { media: null }); }}
              style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12 }}
              title="Remove background"
            >
              ×
            </button>
          </>
        )}
        <span style={{ flex: tab.media ? 0 : 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-3)", textTransform: "uppercase" }}>
          Ratio
        </span>
        <select
          value={String(placement.aspect)}
          onChange={(e) => updatePlacement(node.id, { aspect: Number(e.target.value) })}
          onPointerDown={(e) => e.stopPropagation()}
          style={aspectSelect}
        >
          {ASPECT_PRESETS.some((p) => Math.abs(p.value - placement.aspect) < 0.001) ? null : (
            <option value={String(placement.aspect)}>{placement.aspect.toFixed(2)}</option>
          )}
          {ASPECT_PRESETS.map((p) => (
            <option key={p.label} value={String(p.value)}>{p.label}</option>
          ))}
        </select>
      </Section>

      {/* Framing for the background itself (scale / offset / rotation). */}
      {tab.media && (
        <div style={{ padding: "8px 12px 0" }}>
          <BackgroundTools nodeId={node.id} tabId={tab.id} transform={getTransform(tab)} />
        </div>
      )}

      {/* ── Overlays: what goes ON the background ── */}
      <Section label="Overlays">
        <button
          onClick={(e) => { e.stopPropagation(); addLayer(node.id, tab.id, "text"); }}
          style={toolBtn}
        >
          + Text
        </button>
        <input
          id={overlayInputId}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickOverlay(f); e.target.value = ""; }}
        />
        <label htmlFor={overlayInputId} style={toolBtn}>
          {busy === "overlay" ? "Uploading…" : "+ Image"}
        </label>
      </Section>

      {tab.layers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px 8px" }}>
          {tab.layers.map((l) => {
            const isSel = l.id === selectedLayerId;
            return (
              <span
                key={l.id}
                onClick={(e) => { e.stopPropagation(); setSelectedLayer(isSel ? null : l.id); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 150,
                  padding: "4px 8px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${isSel ? accent : "var(--border-raw)"}`,
                  background: isSel ? `color-mix(in srgb, ${accent} 12%, transparent)` : "var(--surface)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: l.type === "text" ? 1 : "50%", background: accent, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {layerLabel(l)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeLayer(node.id, tab.id, l.id); }}
                  style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
                  aria-label="Remove layer"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Tools for the selected overlay */}
      {selected && (
        <div style={{ padding: "0 12px 10px" }}>
          {selected.type === "text" ? (
            <TextLayerTools nodeId={node.id} tabId={tab.id} layer={selected} />
          ) : (
            <ImageLayerTools nodeId={node.id} tabId={tab.id} layer={selected} />
          )}
        </div>
      )}
      {!selected && tab.layers.length > 0 && (
        <div style={{ padding: "0 12px 10px", fontSize: 10.5, color: "var(--text-3)" }}>
          Pick a layer to edit it — or drag it straight on the preview.
        </div>
      )}
    </>
  );
}

/** A labelled control row (keeps "background" visually apart from "overlays"). */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 12px 0", display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{children}</div>
    </div>
  );
}

/** Natural pixel size of a picked file, so the frame can adopt its ratio. */
async function measureMedia(file: File, kind: "image" | "video"): Promise<{ w: number; h: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }
    return await new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => resolve(null);
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
/** Floors for a dragged text box, in % of the stage — small enough for a word. */
const MIN_BOX_W = 4;
const MIN_BOX_H = 3;

const promptInput: React.CSSProperties = {
  width: "100%", height: "100%", boxSizing: "border-box",
  border: "1px solid var(--border-raw)", borderRadius: 10, padding: "8px 10px",
  fontFamily: "inherit", fontSize: 13, color: "var(--text)", outline: "none", background: "var(--surface)",
};
const toolBtn: React.CSSProperties = {
  border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 999,
  padding: "4px 10px", fontSize: 10.5, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap",
};
const tabBtn: React.CSSProperties = {
  border: "1px solid var(--border-raw)", background: "var(--surface)", borderRadius: 8,
  width: 24, height: 24, fontSize: 12, color: "var(--text-2)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
};
const aspectSelect: React.CSSProperties = {
  border: "1px solid var(--border-raw)", borderRadius: 7, padding: "3px 5px",
  fontSize: 10.5, background: "var(--surface)", color: "var(--text)", outline: "none",
};
