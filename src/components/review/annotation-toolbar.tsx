"use client";

import * as React from "react";
import {
  MousePointer2,
  ArrowUpRight,
  Square,
  Circle,
  Pencil,
  Undo2,
  Redo2,
  Trash2,
  X,
} from "lucide-react";
import { useReviewStore } from "@/lib/review/store";
import type { DrawTool } from "@/lib/review/types";

const TOOLS: { tool: DrawTool; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { tool: "select", icon: MousePointer2, label: "Select" },
  { tool: "arrow", icon: ArrowUpRight, label: "Arrow" },
  { tool: "rect", icon: Square, label: "Rectangle" },
  { tool: "ellipse", icon: Circle, label: "Circle" },
  { tool: "freehand", icon: Pencil, label: "Draw" },
];

// The fixed 7-color palette (no custom color picker).
const PALETTE = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a84ff", "#ffffff", "#0a0a0b"];

export function AnnotationToolbar({
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onDelete,
  onClose,
}: {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const tool = useReviewStore((s) => s.tool);
  const color = useReviewStore((s) => s.color);
  const setTool = useReviewStore((s) => s.setTool);
  const setColor = useReviewStore((s) => s.setColor);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 6,
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {TOOLS.map(({ tool: t, icon: Icon, label }) => (
        <ToolButton key={t} active={tool === t} title={label} onClick={() => setTool(t)}>
          <Icon size={16} />
        </ToolButton>
      ))}

      <Divider />

      {/* color swatches */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setColor(c)}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: c,
              border: color.toLowerCase() === c.toLowerCase()
                ? "2px solid var(--accent)"
                : "1px solid var(--border-2)",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>

      <Divider />

      <ToolButton title="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton title="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={16} />
      </ToolButton>
      <ToolButton title="Delete selected" onClick={onDelete} disabled={!hasSelection} danger>
        <Trash2 size={16} />
      </ToolButton>

      <Divider />

      <ToolButton title="Close annotate" onClick={onClose}>
        <X size={16} />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  danger,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        display: "grid",
        placeItems: "center",
        borderRadius: 7,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        background: active ? "var(--accent-weak)" : "transparent",
        color: disabled
          ? "var(--text-3)"
          : danger
            ? "var(--danger)"
            : active
              ? "var(--accent-ink)"
              : "var(--text-2)",
        opacity: disabled ? 0.5 : 1,
        transition: "background .1s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.background = "rgba(0,0,0,.05)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: "var(--border-raw)", margin: "0 2px" }} />;
}
