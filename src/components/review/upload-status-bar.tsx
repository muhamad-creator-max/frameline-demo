"use client";

import * as React from "react";
import type { UploadProgress } from "@/lib/review/use-upload";
import { CircularProgress } from "./circular-progress";

/**
 * Fixed bottom-left upload status bar. Shows a radial progress ring plus the
 * estimated time remaining for the active upload(s). Renders nothing when no
 * upload is in flight.
 */
export function UploadStatusBar({ items }: { items: UploadProgress[] }) {
  const active = items.filter((i) => i.status === "uploading" || i.status === "processing");
  if (active.length === 0) return null;

  // Drive the ring from the first active item; summarise the rest beneath it.
  const lead = active[0];
  const processing = lead.status === "processing";
  const eta = lead.etaSeconds;

  return (
    <div
      style={{
        position: "fixed",
        insetInlineEnd: 20,
        insetBlockEnd: 20,
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px 12px 12px",
        borderRadius: 14,
        background: "rgba(18, 21, 26, 0.92)",
        boxShadow: "0 12px 40px -10px rgba(0,0,0,.45), 0 2px 8px -2px rgba(0,0,0,.3)",
        backdropFilter: "blur(8px)",
        maxWidth: 320,
      }}
    >
      <CircularProgress value={processing ? undefined : lead.progress} size={44} stroke={4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 220,
          }}
        >
          {lead.name}
        </span>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)" }}>
          {processing
            ? "Processing…"
            : eta != null
              ? `${lead.progress}% · ${formatEta(eta)} left`
              : `Uploading ${lead.progress}%`}
        </span>
        {active.length > 1 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>
            +{active.length - 1} more in queue
          </span>
        )}
      </div>
    </div>
  );
}

/** Human-readable "time remaining" string from a seconds estimate. */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "almost done";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
