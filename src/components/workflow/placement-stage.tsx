"use client";

import * as React from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type {
  PlacementImageLayer,
  PlacementTab,
  PlacementTextLayer,
} from "@/lib/supabase/database.types";
import { DESIGN_W, backgroundTransformCss, getTransform } from "@/lib/workflow/placement";
import { ensureFontLoaded } from "@/lib/workflow/google-fonts";

/** useLayoutEffect that stays quiet during SSR (these surfaces are pre-rendered). */
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * The Placement composite: base media + text/image overlays.
 *
 * Shared by the editor card, the in-editor preview modal and the public client
 * screen — one renderer, so what the editor arranges is exactly what the client
 * sees. It draws into a fixed 1000-unit-wide design space and CSS-scales that
 * layer to the box it's given, which is what makes a 416px card preview and a
 * 760px client stage proportionally identical.
 *
 * Pass `width` when the caller already knows it (the editor card, where the
 * stage height feeds port geometry); omit it to fill and measure the container.
 */
export function PlacementStage({
  tab,
  aspect: aspectProp,
  width,
  selectedLayerId,
  onLayerPointerDown,
  onLayerResize,
  radius = 10,
  emptyHint = "No media yet",
}: {
  /** The option being shown: its background media + overlay stack. */
  tab: PlacementTab;
  aspect: number;
  width?: number;
  /** Editor-only: outlines the layer being edited. */
  selectedLayerId?: string | null;
  /** Editor-only: makes layers draggable (the body owns the drag maths). */
  onLayerPointerDown?: (layerId: string, e: React.PointerEvent) => void;
  /** Editor-only: corner handles on the selected text layer. */
  onLayerResize?: ResizeStart;
  radius?: number;
  emptyHint?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [autoW, setAutoW] = React.useState(0);

  // Only measure when the caller didn't pin a width. The inner layer is
  // absolutely positioned, so observing the box can't feed back into itself.
  useIsoLayoutEffect(() => {
    if (width != null) return;
    const el = boxRef.current;
    if (!el) return;
    setAutoW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setAutoW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const aspect = aspectProp > 0 ? aspectProp : 16 / 9;
  const boxW = width ?? autoW;
  const designH = DESIGN_W / aspect;
  const scale = boxW / DESIGN_W;

  const media = tab.media;
  const transform = getTransform(tab);
  const layers = tab.layers.filter((l) => !l.hidden);

  // Background video: loops muted by default (autoplay only works muted), with
  // its own mini transport instead of the browser's chrome.
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(true);
  const [muted, setMuted] = React.useState(true);

  // React can drop `muted` when it patches an existing <video>, so mirror it.
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {/* autoplay policy — ignore */});
    else v.pause();
  }

  // Load every font in use (at the weight it's used at) before it's needed.
  const fontKey = layers.map((l) => (l.type === "text" ? `${l.font}:${l.weight}` : "")).join("|");
  React.useEffect(() => {
    for (const entry of fontKey.split("|")) {
      if (!entry) continue;
      const [family, weight] = entry.split(":");
      ensureFontLoaded(family, [Number(weight) || 400]);
    }
  }, [fontKey]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        width: width != null ? width : "100%",
        aspectRatio: `${aspect}`,
        borderRadius: radius,
        overflow: "hidden",
        // The empty stage stays dark on purpose: overlays default to white text,
        // and they have to be legible while you compose a caption before the
        // footage exists.
        background: media ? "#0b0b0c" : "#17171a",
        border: media ? "none" : "1px dashed rgba(255,255,255,0.18)",
        boxSizing: "border-box",
      }}
    >
      {!media && (
        <div
          style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 12,
          }}
        >
          {emptyHint}
        </div>
      )}

      {/* Design-space layer: everything inside is authored against a 1000-unit
          width and scaled as one block, so overlays keep their exact relative
          size/position at any stage width.
          The BACKGROUND MEDIA LIVES IN HERE TOO, and that is load-bearing:
          mix-blend-mode only blends against the backdrop inside its own
          stacking context, so a media element outside this isolated group
          leaves every overlay blending against nothing (i.e. blend modes
          silently do nothing). Keep media and overlays in the same group. */}
      {boxW > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: DESIGN_W,
            height: designH,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            isolation: "isolate",
          }}
        >
          {media?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt=""
              draggable={false}
              style={{ ...mediaStyle, transform: backgroundTransformCss(transform) }}
            />
          )}
          {media?.kind === "video" && (
            <video
              ref={videoRef}
              src={media.url}
              muted={muted}
              loop
              autoPlay
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              style={{ ...mediaStyle, transform: backgroundTransformCss(transform) }}
            />
          )}

          {layers.map((layer) =>
            layer.type === "text" ? (
              <TextLayer
                key={layer.id}
                layer={layer}
                designH={designH}
                selected={selectedLayerId === layer.id}
                scale={scale}
                onPointerDown={onLayerPointerDown}
                onResizePointerDown={onLayerResize}
              />
            ) : (
              <ImageLayer
                key={layer.id}
                layer={layer}
                selected={selectedLayerId === layer.id}
                scale={scale}
                onPointerDown={onLayerPointerDown}
              />
            ),
          )}
        </div>
      )}

      {/* Mini transport for background video. Deliberately OUTSIDE the scaled
          design layer: it must stay the same size at any preview width, and
          anything inside that layer would get caught by the blend group. */}
      {media?.kind === "video" && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 4, zIndex: 4,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.65))",
          }}
        >
          <TransportButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <Pause size={13} strokeWidth={2.2} /> : <Play size={13} strokeWidth={2.2} />}
          </TransportButton>
          <TransportButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX size={13} strokeWidth={2.2} /> : <Volume2 size={13} strokeWidth={2.2} />}
          </TransportButton>
        </div>
      )}
    </div>
  );
}

/** Grey, 50%-opacity transport icon; brightens on hover so it stays clickable. */
function TransportButton({
  label, onClick, children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      aria-label={label}
      style={{
        width: 20, height: 20, padding: 0, border: "none", background: "none",
        display: "grid", placeItems: "center", cursor: "pointer",
        color: "#d4d4d8", opacity: hover ? 0.85 : 0.5, transition: "opacity .12s ease",
      }}
    >
      {children}
    </button>
  );
}

const mediaStyle: React.CSSProperties = {
  position: "absolute", inset: 0, width: "100%", height: "100%",
  objectFit: "cover", transformOrigin: "center",
};

function TextLayer({
  layer, designH, selected, scale, onPointerDown, onResizePointerDown,
}: {
  layer: PlacementTextLayer;
  designH: number;
  selected: boolean;
  scale: number;
  onPointerDown?: (layerId: string, e: React.PointerEvent) => void;
  onResizePointerDown?: ResizeStart;
}) {
  // size is a % of stage height; shadow offsets + corner radius are % of the
  // resulting font size, so the whole block scales as one.
  const fontSize = (designH * layer.size) / 100;
  const sh = layer.shadow;
  const ref = React.useRef<HTMLDivElement>(null);
  const sized = layer.boxW != null || layer.boxH != null;

  /** Hand the corner drag over with the box's CURRENT size measured in %, which
   *  is the only way the first resize of an auto-sized box knows where it began. */
  function startResize(corner: Corner, e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !onResizePointerDown) return;
    onResizePointerDown(layer.id, corner, e, {
      w: (el.offsetWidth / DESIGN_W) * 100,
      h: (el.offsetHeight / designH) * 100,
    });
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown ? (e) => onPointerDown(layer.id, e) : undefined}
      style={{
        position: "absolute",
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        // An absolutely positioned box with `width: auto` shrink-to-fits into
        // (containing block − left), so it got NARROWER the further right it
        // sat. `max-content` ignores the available space and keeps the box the
        // same width wherever it's placed; the % max-width still wraps long
        // copy at a fixed fraction of the stage.
        width: layer.boxW != null ? `${layer.boxW}%` : "max-content",
        maxWidth: layer.boxW != null ? undefined : "88%",
        height: layer.boxH != null ? `${layer.boxH}%` : undefined,
        // With an explicit box the text centres inside it; when auto, the box
        // hugs the text and this is a no-op.
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        fontFamily: `"${layer.font}", system-ui, sans-serif`,
        fontWeight: layer.weight,
        fontSize,
        lineHeight: 1.18,
        color: layer.color,
        textAlign: "center",
        whiteSpace: "pre-wrap",
        textShadow: sh.on
          ? `${(fontSize * sh.x) / 100}px ${(fontSize * sh.y) / 100}px ${(fontSize * sh.blur) / 100}px ${sh.color}`
          : undefined,
        background: layer.bg.on ? layer.bg.color : undefined,
        padding: layer.bg.on ? `${fontSize * 0.28}px ${fontSize * 0.55}px` : undefined,
        borderRadius: layer.bg.on ? (fontSize * layer.bg.radius) / 100 : undefined,
        outline: selected ? `${1.5 / scale}px dashed rgba(255,255,255,0.9)` : undefined,
        outlineOffset: selected ? `${3 / scale}px` : undefined,
        cursor: onPointerDown ? "move" : undefined,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <span style={{ minWidth: 0 }}>{layer.text || " "}</span>

      {/* Four round corner handles — free (non-proportional) resize of the box. */}
      {selected && onResizePointerDown && (
        <>
          {CORNERS.map((corner) => (
            <ResizeHandle key={corner} corner={corner} scale={scale} onPointerDown={(e) => startResize(corner, e)} />
          ))}
          {sized && (
            <span
              // Tiny hint that the box is no longer auto-sized.
              style={{
                position: "absolute", left: "50%", top: `calc(100% + ${6 / scale}px)`,
                transform: "translateX(-50%)", fontSize: 11 / scale, lineHeight: 1,
                color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", pointerEvents: "none",
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              {Math.round(layer.boxW ?? 0)} × {Math.round(layer.boxH ?? 0)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export const CORNERS = ["nw", "ne", "se", "sw"] as const;
export type Corner = (typeof CORNERS)[number];
/** Corner-drag handoff: the body owns the maths, the stage owns the measurement. */
export type ResizeStart = (
  layerId: string,
  corner: Corner,
  e: React.PointerEvent,
  size: { w: number; h: number },
) => void;

function ResizeHandle({
  corner, scale, onPointerDown,
}: {
  corner: Corner;
  scale: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  // Screen-constant size: the whole design layer is scaled, so divide it out.
  const d = 9 / scale;
  const north = corner === "nw" || corner === "ne";
  const west = corner === "nw" || corner === "sw";
  return (
    <span
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onPointerDown(e); }}
      style={{
        position: "absolute",
        top: north ? 0 : undefined,
        bottom: north ? undefined : 0,
        left: west ? 0 : undefined,
        right: west ? undefined : 0,
        transform: `translate(${west ? "-50%" : "50%"}, ${north ? "-50%" : "50%"})`,
        width: d, height: d, borderRadius: "50%",
        background: "#fff",
        border: `${1.5 / scale}px solid rgba(0,0,0,0.55)`,
        cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
        zIndex: 2,
      }}
    />
  );
}

function ImageLayer({
  layer, selected, scale, onPointerDown,
}: {
  layer: PlacementImageLayer;
  selected: boolean;
  scale: number;
  onPointerDown?: (layerId: string, e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown ? (e) => onPointerDown(layer.id, e) : undefined}
      style={{
        position: "absolute",
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.scale}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        mixBlendMode: layer.blend,
        opacity: layer.opacity / 100,
        outline: selected ? `${1.5 / scale}px dashed rgba(255,255,255,0.9)` : undefined,
        outlineOffset: selected ? `${3 / scale}px` : undefined,
        cursor: onPointerDown ? "move" : undefined,
        lineHeight: 0,
      }}
    >
      {layer.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.url} alt="" draggable={false} style={{ width: "100%", height: "auto", display: "block" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "1", background: "rgba(255,255,255,0.15)", borderRadius: 8 }} />
      )}
    </div>
  );
}
