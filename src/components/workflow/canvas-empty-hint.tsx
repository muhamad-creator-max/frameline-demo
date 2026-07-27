"use client";

import * as React from "react";
import { MousePointerClick } from "lucide-react";

/** Centered hint shown on a blank canvas. Purely decorative; ignores pointers. */
export function CanvasEmptyHint() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div
          style={{
            display: "inline-flex", width: 46, height: 46, borderRadius: 13,
            background: "var(--accent-weak)", color: "var(--accent-ink)",
            alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}
        >
          <MousePointerClick size={22} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>
          Build your flow
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
          Add a <strong>Start</strong> node and questions from the toolbar on the left,
          then drag from a node’s green port to connect answers to the next question.
        </p>
      </div>
    </div>
  );
}
