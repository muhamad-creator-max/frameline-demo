"use client";

import * as React from "react";

/**
 * Rounded-rectangle status pill with a leading status dot.
 *
 * Tones map to the app's CSS tokens (never hardcoded colors) so pills stay on
 * theme in light + dark. Renders as a <button> when `onClick` is given
 * (clickable toggle, as on the list pages), otherwise a static <span>.
 */
export type StatusTone = "success" | "neutral" | "muted" | "warning" | "danger" | "info";

interface ToneStyle {
  dot: string;
  bg: string;
  fg: string;
}

/**
 * Canvas-design pill: a neutral zinc shell with a coloured status dot — colour
 * lives in the dot, not the chrome. Every value is a CSS variable, so swapping
 * the token set reskins every pill.
 */
const TONES: Record<StatusTone, ToneStyle> = {
  success: { dot: "var(--success)", bg: "var(--surface-2)", fg: "var(--text-2)" },
  info:    { dot: "oklch(0.55 0.19 265)", bg: "var(--surface-2)", fg: "var(--text-2)" },
  warning: { dot: "var(--warning)", bg: "var(--surface-2)", fg: "var(--text-2)" },
  danger:  { dot: "var(--danger)",  bg: "var(--surface-2)", fg: "var(--text-2)" },
  neutral: { dot: "var(--text-3)",  bg: "var(--surface-2)", fg: "var(--text-2)" },
  muted:   { dot: "var(--border-2)", bg: "var(--surface-2)", fg: "var(--text-3)" },
};

/** Common mapping for the draft/published/archived lifecycle used by list pages. */
export function publishStatusTone(status: "draft" | "published" | "archived"): StatusTone {
  return status === "published" ? "success" : status === "draft" ? "neutral" : "muted";
}

/** Human label for the same lifecycle (public/private/archived). */
export function publishStatusLabel(status: "draft" | "published" | "archived"): string {
  return status === "published" ? "Public" : status === "draft" ? "Private" : "Archived";
}

export function StatusPill({
  tone = "neutral",
  children,
  onClick,
  title,
  pulse = false,
  style,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  /** Animate the dot (e.g. for an in-progress / live state). */
  pulse?: boolean;
  style?: React.CSSProperties;
}) {
  const t = TONES[tone];
  const clickable = !!onClick;

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: t.bg,
    color: t.fg,
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--border-raw)",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    cursor: clickable ? "pointer" : "default",
    ...style,
  };

  const dot = (
    <span
      aria-hidden
      className={pulse ? "status-dot-pulse" : undefined}
      style={{
        width: 6,
        height: 6,
        borderRadius: 99,
        background: t.dot,
        flexShrink: 0,
      }}
    />
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} title={title} style={base}>
        {dot}
        {children}
      </button>
    );
  }
  return (
    <span title={title} style={base}>
      {dot}
      {children}
    </span>
  );
}
