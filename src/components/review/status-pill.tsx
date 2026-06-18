"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import type { CommentStatus } from "@/lib/supabase/database.types";
import { STATUS_OPTIONS, statusOption } from "@/lib/review/status";

/**
 * Notion-style status control. Colors/labels come entirely from
 * STATUS_OPTIONS (CSS-token driven) — nothing is hardcoded per status here.
 * Read-only mode renders just the chip (used in guest view where guests can't
 * change status).
 */
export function StatusPill({
  status,
  onChange,
  readOnly,
}: {
  status: CommentStatus;
  onChange?: (next: CommentStatus) => void;
  readOnly?: boolean;
}) {
  const opt = statusOption(status);

  const chip = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        background: opt.bg,
        color: opt.fg,
        whiteSpace: "nowrap",
        cursor: readOnly ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: opt.dot,
          flexShrink: 0,
        }}
      />
      {opt.label}
    </span>
  );

  if (readOnly || !onChange) return chip;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          {chip}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[170px]">
        {STATUS_OPTIONS.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className="flex items-center gap-2 text-[13px]"
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.value === status && <Check size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
