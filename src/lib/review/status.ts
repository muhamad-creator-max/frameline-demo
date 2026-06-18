import type { CommentStatus } from "@/lib/supabase/database.types";

/**
 * Notion-style comment status config — the single source of truth for status
 * labels and colors. Colors resolve from the app's CSS design tokens
 * (light/dark themes drive them) so nothing is hardcoded per-status at the call
 * site. `status-pill.tsx` and the status dropdown both read from here.
 */
export interface StatusOption {
  value: CommentStatus;
  label: string;
  /** The little Notion dot color (CSS color or var). */
  dot: string;
  /** Chip background tint. */
  bg: string;
  /** Chip text/label color. */
  fg: string;
}

export const STATUS_OPTIONS: readonly StatusOption[] = [
  {
    value: "open",
    label: "Not started",
    dot: "var(--text-3)",
    bg: "var(--surface-2)",
    fg: "var(--text-2)",
  },
  {
    value: "in_progress",
    label: "In progress",
    // Amber accent — kept as a token-style rgba so it reads in both themes.
    dot: "#f5a623",
    bg: "rgba(245,166,35,.14)",
    fg: "#b8770d",
  },
  {
    value: "done",
    label: "Done",
    dot: "var(--accent)",
    bg: "var(--accent-weak)",
    fg: "var(--accent-ink)",
  },
] as const;

export function statusOption(value: CommentStatus): StatusOption {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}
