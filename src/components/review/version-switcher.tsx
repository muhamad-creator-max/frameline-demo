"use client";

import * as React from "react";
import { ChevronDown, Check, CircleDot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VersionDTO } from "@/lib/review/types";

export function VersionSwitcher({
  versions,
  activeId,
  onSelect,
}: {
  versions: VersionDTO[];
  activeId: string;
  onSelect: (versionId: string) => void;
}) {
  const active = versions.find((v) => v.id === activeId) ?? versions[versions.length - 1];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 7,
            border: "1px solid var(--border-raw)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <CircleDot size={13} style={{ color: "var(--accent)" }} />
          V{active.version}
          {versions.length > 1 && <span style={{ color: "var(--text-3)" }}>of {versions.length}</span>}
          <ChevronDown size={13} style={{ color: "var(--text-3)" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {[...versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => (
            <DropdownMenuItem
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="flex items-center gap-2 text-[13px]"
            >
              <span style={{ flex: 1 }}>Version {v.version}</span>
              {v.status !== "ready" && (
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{v.status}</span>
              )}
              {v.id === active.id && <Check size={14} />}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
