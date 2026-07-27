import type { WorkflowNodeKind } from "@/lib/supabase/database.types";

/**
 * Per-node-type accent palette, ported from the Canvas Workflow Builder design.
 * `accent` drives the header dot + JetBrains-Mono type label; `soft` is the
 * tinted tile background used in the left toolbar. OKLCH keeps the hues vivid
 * and consistent in light mode. Single source of truth — do not hardcode these
 * per-component.
 */
export interface NodeAccent {
  label: string;
  accent: string;
  soft: string;
}

export const NODE_THEME: Record<WorkflowNodeKind, NodeAccent> = {
  start:    { label: "START",    accent: "oklch(0.62 0.19 150)", soft: "oklch(0.96 0.03 150)" },
  question: { label: "QUESTION", accent: "oklch(0.55 0.19 265)", soft: "oklch(0.96 0.02 265)" },
  choice:   { label: "CHOICE",   accent: "oklch(0.55 0.19 310)", soft: "oklch(0.96 0.02 310)" },
  identity: { label: "IDENTITY", accent: "oklch(0.68 0.16 70)",  soft: "oklch(0.96 0.03 70)" },
  note:     { label: "NOTE",     accent: "oklch(0.58 0.13 170)", soft: "oklch(0.96 0.02 170)" },
  placement:{ label: "PLACEMENT",accent: "oklch(0.62 0.19 25)",  soft: "oklch(0.96 0.03 25)" },
};

/** Human labels for the five Question answer channels, in display order. */
export const ANSWER_TYPE_ORDER = ["text", "image", "video", "link", "file"] as const;
export type AnswerTypeKey = (typeof ANSWER_TYPE_ORDER)[number];

export const ANSWER_TYPE_LABEL: Record<AnswerTypeKey, string> = {
  text: "Text answer",
  image: "Image upload",
  video: "Video upload",
  link: "Link / URL",
  file: "File upload",
};
