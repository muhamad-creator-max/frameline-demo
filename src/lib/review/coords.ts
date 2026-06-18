import type { AnnotationCoordinates, AnnotationType } from "@/lib/supabase/database.types";

/**
 * Coordinate helpers. Annotations are STORED as 0..1 percentages of the media
 * box and converted to pixels only at render time against the measured box, so
 * they stay aligned at any screen size (an explicit product requirement).
 */

export interface Box {
  width: number;
  height: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Pixel point → normalized [0..1] against the box. */
export function toPct(px: number, py: number, box: Box): { x: number; y: number } {
  return {
    x: box.width ? clamp01(px / box.width) : 0,
    y: box.height ? clamp01(py / box.height) : 0,
  };
}

/** Normalized [0..1] point → pixels against the box. */
export function toPx(x: number, y: number, box: Box): { x: number; y: number } {
  return { x: x * box.width, y: y * box.height };
}

/**
 * Render-ready pixel geometry for Konva, derived from normalized coordinates.
 * Returns a discriminated shape keyed by annotation type.
 */
export type PixelShape =
  | { type: "arrow"; points: number[] }
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "ellipse"; x: number; y: number; radiusX: number; radiusY: number }
  | { type: "freehand"; points: number[] }
  | { type: "text"; x: number; y: number; text: string; fontSize: number };

export function coordsToPixels(
  type: AnnotationType,
  c: AnnotationCoordinates,
  box: Box,
): PixelShape {
  switch (type) {
    case "arrow": {
      const a = toPx(c.x ?? 0, c.y ?? 0, box);
      const b = toPx(c.endX ?? 0, c.endY ?? 0, box);
      return { type: "arrow", points: [a.x, a.y, b.x, b.y] };
    }
    case "rect": {
      const o = toPx(c.x ?? 0, c.y ?? 0, box);
      return { type: "rect", x: o.x, y: o.y, width: (c.w ?? 0) * box.width, height: (c.h ?? 0) * box.height };
    }
    case "ellipse": {
      const w = (c.w ?? 0) * box.width;
      const h = (c.h ?? 0) * box.height;
      const o = toPx(c.x ?? 0, c.y ?? 0, box);
      // Konva Ellipse positions by center.
      return { type: "ellipse", x: o.x + w / 2, y: o.y + h / 2, radiusX: w / 2, radiusY: h / 2 };
    }
    case "freehand": {
      const pts = c.points ?? [];
      const out: number[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        out.push(pts[i] * box.width, (pts[i + 1] ?? 0) * box.height);
      }
      return { type: "freehand", points: out };
    }
    case "text": {
      const o = toPx(c.x ?? 0, c.y ?? 0, box);
      return { type: "text", x: o.x, y: o.y, text: c.text ?? "", fontSize: (c.fontSize ?? 0.05) * box.height };
    }
  }
}

/** mm:ss (or h:mm:ss) formatter for timestamp chips. */
export function formatTimecode(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export const DEFAULT_FPS = 30;

/**
 * Frame-accurate SMPTE-style timecode: `HH:MM:SS:FR`, where FR is the frame
 * within the current second (0..fps-1). Used across the review player + comment
 * timestamp chips so feedback is frame-precise.
 */
export function formatTimecodeFrames(
  seconds: number | null | undefined,
  fps: number = DEFAULT_FPS,
): string {
  const safeFps = fps && isFinite(fps) && fps > 0 ? fps : DEFAULT_FPS;
  if (seconds == null || !isFinite(seconds) || seconds < 0) {
    return `00:00:00:${"0".padStart(2, "0")}`;
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // Frame index within the second; clamp to fps-1 to avoid rounding to "fps".
  const fr = Math.min(safeFps - 1, Math.floor((seconds - total) * safeFps));
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)}:${p2(fr)}`;
}
