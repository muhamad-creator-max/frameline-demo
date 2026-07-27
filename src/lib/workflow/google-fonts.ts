"use client";

/**
 * Google Fonts helper for the Identity node.
 *
 * We ship a curated list (family + supported subsets) instead of hitting the
 * Google Fonts Developer API, so no API key is required. Fonts are loaded on
 * demand by injecting a Google Fonts CSS2 <link> — that endpoint is public and
 * needs no key. If you later add a GOOGLE_FONTS_API_KEY, this list can be
 * swapped for the full live catalogue behind an API route.
 */

export interface FontEntry {
  family: string;
  /** Language subsets this family supports (used by the picker's language filter). */
  subsets: string[];
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
}

export const FONT_SUBSETS: { id: string; label: string }[] = [
  { id: "latin", label: "Latin" },
  { id: "latin-ext", label: "Latin Extended" },
  { id: "arabic", label: "Arabic" },
  { id: "cyrillic", label: "Cyrillic" },
  { id: "greek", label: "Greek" },
  { id: "hebrew", label: "Hebrew" },
  { id: "devanagari", label: "Devanagari" },
  { id: "thai", label: "Thai" },
  { id: "korean", label: "Korean" },
  { id: "japanese", label: "Japanese" },
  { id: "chinese-simplified", label: "Chinese (Simplified)" },
];

// A pragmatic, design-forward subset of the Google Fonts catalogue. Covers the
// common Latin workhorses plus popular Arabic / CJK / Indic families so the
// language filter is meaningful.
export const GOOGLE_FONTS: FontEntry[] = [
  { family: "Inter", subsets: ["latin", "latin-ext", "cyrillic", "greek"], category: "sans-serif" },
  { family: "Roboto", subsets: ["latin", "latin-ext", "cyrillic", "greek"], category: "sans-serif" },
  { family: "Open Sans", subsets: ["latin", "latin-ext", "cyrillic", "greek", "hebrew"], category: "sans-serif" },
  { family: "Montserrat", subsets: ["latin", "latin-ext", "cyrillic"], category: "sans-serif" },
  { family: "Poppins", subsets: ["latin", "latin-ext", "devanagari"], category: "sans-serif" },
  { family: "Lato", subsets: ["latin", "latin-ext"], category: "sans-serif" },
  { family: "Nunito", subsets: ["latin", "latin-ext", "cyrillic"], category: "sans-serif" },
  { family: "Work Sans", subsets: ["latin", "latin-ext"], category: "sans-serif" },
  { family: "DM Sans", subsets: ["latin", "latin-ext"], category: "sans-serif" },
  { family: "Manrope", subsets: ["latin", "latin-ext", "cyrillic", "greek"], category: "sans-serif" },
  { family: "Raleway", subsets: ["latin", "latin-ext", "cyrillic"], category: "sans-serif" },
  { family: "Rubik", subsets: ["latin", "latin-ext", "cyrillic", "hebrew", "arabic"], category: "sans-serif" },
  { family: "Playfair Display", subsets: ["latin", "latin-ext", "cyrillic"], category: "serif" },
  { family: "Merriweather", subsets: ["latin", "latin-ext", "cyrillic"], category: "serif" },
  { family: "Lora", subsets: ["latin", "latin-ext", "cyrillic"], category: "serif" },
  { family: "Source Serif 4", subsets: ["latin", "latin-ext", "cyrillic", "greek"], category: "serif" },
  { family: "Bebas Neue", subsets: ["latin", "latin-ext"], category: "display" },
  { family: "Oswald", subsets: ["latin", "latin-ext", "cyrillic"], category: "display" },
  { family: "Anton", subsets: ["latin", "latin-ext"], category: "display" },
  { family: "Archivo Black", subsets: ["latin", "latin-ext"], category: "display" },
  { family: "Pacifico", subsets: ["latin", "latin-ext", "cyrillic"], category: "handwriting" },
  { family: "Caveat", subsets: ["latin", "latin-ext", "cyrillic"], category: "handwriting" },
  { family: "Dancing Script", subsets: ["latin", "latin-ext"], category: "handwriting" },
  { family: "JetBrains Mono", subsets: ["latin", "latin-ext", "cyrillic", "greek"], category: "monospace" },
  { family: "Space Mono", subsets: ["latin", "latin-ext"], category: "monospace" },
  // Arabic
  { family: "Cairo", subsets: ["latin", "arabic"], category: "sans-serif" },
  { family: "Tajawal", subsets: ["latin", "arabic"], category: "sans-serif" },
  { family: "Almarai", subsets: ["arabic"], category: "sans-serif" },
  { family: "Amiri", subsets: ["latin", "arabic"], category: "serif" },
  { family: "Noto Kufi Arabic", subsets: ["arabic"], category: "sans-serif" },
  // CJK
  { family: "Noto Sans JP", subsets: ["latin", "japanese"], category: "sans-serif" },
  { family: "Noto Sans KR", subsets: ["latin", "korean"], category: "sans-serif" },
  { family: "Noto Sans SC", subsets: ["latin", "chinese-simplified"], category: "sans-serif" },
  // Indic / Thai
  { family: "Hind", subsets: ["latin", "devanagari"], category: "sans-serif" },
  { family: "Sarabun", subsets: ["latin", "thai"], category: "sans-serif" },
  // Hebrew
  { family: "Heebo", subsets: ["latin", "hebrew"], category: "sans-serif" },
];

export const DEFAULT_FONT = "Inter";

/** Fonts we never need to inject — they're already available in the app UI. */
const SYSTEM_FONTS = new Set(["Inter", "system-ui", "sans-serif"]);

const injected = new Set<string>();

/**
 * Inject the Google Fonts CSS2 stylesheet for `family` at the given weights.
 * Safe to call repeatedly (deduped per family+weight) and on every render.
 * No-op on the server.
 *
 * One <link> PER WEIGHT on purpose: the CSS2 endpoint rejects the whole request
 * with a 400 when a family doesn't ship one of the weights in a combined
 * `wght@400;600;700` list — which silently killed every single-weight display
 * face (Anton, Bebas Neue, Pacifico…). Asking one weight at a time means an
 * unsupported weight costs only that link, and the browser synthesises from the
 * weights that did load.
 */
export function ensureFontLoaded(family: string | undefined, weights: number[] = [400, 700]) {
  if (!family || typeof document === "undefined") return;
  if (SYSTEM_FONTS.has(family)) return;

  for (const weight of weights) {
    const key = `${family}@${weight}`;
    if (injected.has(key)) continue;
    injected.add(key);

    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(
      /%20/g,
      "+",
    )}:wght@${weight}&display=swap`;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.workflowFont = key;
    document.head.appendChild(link);
  }
}

/** Filter the catalogue by search text + optional subset. */
export function filterFonts(query: string, subset: string | null): FontEntry[] {
  const q = query.trim().toLowerCase();
  return GOOGLE_FONTS.filter((f) => {
    if (subset && !f.subsets.includes(subset)) return false;
    if (q && !f.family.toLowerCase().includes(q)) return false;
    return true;
  });
}
