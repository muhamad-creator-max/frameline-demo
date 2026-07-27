import type {
  PlacementConfig,
  PlacementBlendMode,
  PlacementImageLayer,
  PlacementRespondType,
  PlacementTab,
  PlacementTextLayer,
  PlacementTransform,
  QuestionAnswerConfig,
  WorkflowNodeData,
} from "@/lib/supabase/database.types";

/**
 * Placement node model helpers.
 *
 * The Placement node shows a base image/video with text + image overlays on top,
 * so a client can see exactly how a caption or logo will sit on the frame. The
 * golden rule: **every geometric value is relative, never px**.
 *
 *   layer.x / layer.y   → % of stage width / height (layer CENTRE)
 *   text.size           → % of stage height
 *   text.shadow x/y/blur→ % of the font size
 *   text.bg.radius      → % of the font size
 *   image.scale         → % of stage width
 *
 * `PlacementStage` renders into a fixed 1000-unit-wide design space and CSS-
 * scales it to whatever box it's given, so the tiny editor card and the client's
 * full-screen view are pixel-proportional to each other.
 */

/** Width of the design space the stage renders into before being scaled. */
export const DESIGN_W = 1000;

/** Placement cards are wider than the standard 300px node — they hold a preview. */
export const PLACEMENT_CARD_W = 440;
/** Title block above the stage (one-line prompt input). */
export const PLACEMENT_TITLE_H = 52;
/** Option-tab strip between the title and the stage. */
export const PLACEMENT_TABS_H = 36;
/** Horizontal padding around the stage inside the card. */
export const PLACEMENT_PAD = 12;

export const DEFAULT_ASPECT = 16 / 9;

export const ASPECT_PRESETS: { label: string; value: number }[] = [
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
  { label: "2.39:1", value: 2.39 },
];

export const BLEND_MODES: PlacementBlendMode[] = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion", "hue", "saturation", "color", "luminosity",
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

/**
 * Client-side ceiling for background media, mirroring the 50 MB cap in
 * /api/workflows/uploads/bunny. Checked before the upload starts so an oversized
 * clip fails instantly with a clear message instead of after a long wait.
 */
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Stage size inside a card: it always spans the card's full inner width and the
 * height simply follows the ratio — a portrait frame makes the card taller
 * rather than shrinking the preview into a letterboxed sliver.
 */
export function stageSize(aspect: number, boxW: number): { w: number; h: number } {
  const a = aspect > 0 ? aspect : DEFAULT_ASPECT;
  return { w: boxW, h: boxW / a };
}

/** Stage height for a placement card body (drives the output port's Y). */
export function cardStageH(config: PlacementConfig): number {
  return stageSize(config.aspect, PLACEMENT_CARD_W - PLACEMENT_PAD * 2).h;
}

/**
 * Id of the tab synthesised for pre-tabs payloads. Constant on purpose:
 * `getPlacement` is called on every render, so it must never mint fresh ids.
 */
export const LEGACY_TAB_ID = "main";

/**
 * Read a node's placement config, folding the pre-tabs payload (a single
 * media + layers pair) into tabs[0]. Always returns at least one tab, and never
 * echoes the legacy keys back — the first store write drops them for good.
 */
export function getPlacement(data: WorkflowNodeData): PlacementConfig {
  const p = data.placement;
  const aspect = p?.aspect && p.aspect > 0 ? p.aspect : DEFAULT_ASPECT;
  const respond = p?.respond ?? "text";
  const tabs: PlacementTab[] = p?.tabs?.length
    ? p.tabs
    : [{ id: LEGACY_TAB_ID, name: "Option 1", media: p?.media ?? null, layers: p?.layers ?? [] }];
  return { tabs, aspect, respond };
}

/** The tab being edited/previewed — `activeId` when it still exists, else the first. */
export function activeTab(config: PlacementConfig, activeId: string | null): PlacementTab {
  return config.tabs.find((t) => t.id === activeId) ?? config.tabs[0];
}

export function emptyTab(id: string, name: string): PlacementTab {
  return { id, name, media: null, transform: { ...DEFAULT_TRANSFORM }, layers: [] };
}

/** Untransformed background: fills the frame, centred, upright. */
export const DEFAULT_TRANSFORM: PlacementTransform = { scale: 100, x: 0, y: 0, rotation: 0 };

/** A tab's background framing, defaulted for tabs saved before it existed. */
export function getTransform(tab: PlacementTab): PlacementTransform {
  return { ...DEFAULT_TRANSFORM, ...(tab.transform ?? {}) };
}

/** CSS transform for the background media. Order matters: the translate is in
 *  stage units (unscaled), so x/y stay a straight % of the frame. */
export function backgroundTransformCss(t: PlacementTransform): string {
  return `translate(${t.x}%, ${t.y}%) scale(${t.scale / 100}) rotate(${t.rotation}deg)`;
}

export function defaultTextLayer(id: string): PlacementTextLayer {
  return {
    id,
    type: "text",
    text: "Your caption here",
    font: "Inter",
    lang: "latin",
    weight: 700,
    size: 9,
    color: "#ffffff",
    x: 50,
    y: 82,
    rotation: 0,
    shadow: { on: true, x: 0, y: 8, blur: 24, color: "#000000" },
    bg: { on: false, color: "#000000", radius: 30 },
  };
}

export function defaultImageLayer(id: string, url: string, name?: string): PlacementImageLayer {
  return {
    id,
    type: "image",
    url,
    name,
    scale: 22,
    x: 84,
    y: 16,
    rotation: 0,
    blend: "normal",
    opacity: 100,
  };
}

/** Short label for a layer chip / list row. */
export function layerLabel(layer: PlacementTextLayer | PlacementImageLayer): string {
  if (layer.type === "text") return layer.text.trim() || "Text";
  return layer.name?.trim() || "Image";
}

/** Human label for the respond-type setting (also used by the client surface). */
export const RESPOND_LABEL: Record<PlacementRespondType, string> = {
  text: "Text",
  media: "Media",
  link: "Link",
};

export const RESPOND_HINT: Record<PlacementRespondType, string> = {
  text: "Tell us what you think of this placement.",
  media: "Upload an image or video in response.",
  link: "Paste a link in response.",
};

/**
 * Map the respond type onto the Question answer-channel config, so the placement
 * screen can reuse the client's answer composer verbatim.
 */
export function respondAnswerConfig(respond: PlacementRespondType): QuestionAnswerConfig {
  return {
    text: respond === "text",
    image: respond === "media",
    video: respond === "media",
    link: respond === "link",
    file: false,
  };
}

/** Whether a draft satisfies the node's respond type (drives Next/Finish). */
export function hasPlacementAnswer(
  respond: PlacementRespondType,
  draft: { text?: string; link?: string; files?: unknown[] },
): boolean {
  if (respond === "text") return !!draft.text?.trim();
  if (respond === "link") return !!draft.link?.trim();
  return (draft.files?.length ?? 0) > 0;
}
