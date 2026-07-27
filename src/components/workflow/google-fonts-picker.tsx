"use client";

import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import {
  filterFonts,
  ensureFontLoaded,
  FONT_SUBSETS,
  type FontEntry,
} from "@/lib/workflow/google-fonts";

/**
 * Google Fonts dropdown with live per-row preview + a language (subset) filter.
 * No API key needed — the catalogue is curated in google-fonts.ts and each font
 * is injected via the public CSS2 endpoint when previewed or chosen.
 */
export function GoogleFontsPicker({
  value,
  language,
  onChange,
}: {
  value: string;
  /** Currently selected subset (e.g. "arabic"); scopes the search + persists on the box. */
  language: string;
  onChange: (family: string, subset: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [subset, setSubset] = React.useState<string>(language || "latin");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Ensure the selected font is available for the trigger preview. Previews only
  // ever need the regular weight — keeps the injected <link> count sane.
  React.useEffect(() => ensureFontLoaded(value, [400]), [value]);

  const results = React.useMemo(() => filterFonts(query, subset), [query, subset]);

  // Lazy-inject fonts as they appear in the list (first ~40 to avoid flooding).
  React.useEffect(() => {
    if (!open) return;
    results.slice(0, 40).forEach((f) => ensureFontLoaded(f.family, [400]));
  }, [open, results]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-raw)",
          background: "var(--surface)",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <span style={{ fontFamily: `"${value}", system-ui, sans-serif`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <ChevronDown size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 60,
            background: "var(--surface)",
            border: "1px solid var(--border-raw)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            padding: 8,
          }}
        >
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 7, background: "var(--surface-2)", marginBottom: 6 }}>
            <Search size={13} style={{ color: "var(--text-3)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--text)" }}
            />
          </div>

          {/* Language filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {FONT_SUBSETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubset(s.id)}
                style={{
                  fontSize: 10.5,
                  padding: "3px 8px",
                  borderRadius: 99,
                  border: "1px solid var(--border-raw)",
                  background: subset === s.id ? "var(--accent)" : "transparent",
                  color: subset === s.id ? "var(--accent-contrast)" : "var(--text-2)",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
            {results.length === 0 && (
              <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--text-3)" }}>No fonts match.</div>
            )}
            {results.map((f) => (
              <FontRow
                key={f.family}
                font={f}
                selected={f.family === value}
                onSelect={() => {
                  ensureFontLoaded(f.family, [400]);
                  onChange(f.family, subset);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FontRow({ font, selected, onSelect }: { font: FontEntry; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "7px 9px",
        borderRadius: 7,
        border: "none",
        background: selected ? "var(--accent-weak)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--surface-2)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: `"${font.family}", system-ui, sans-serif`, fontSize: 15, color: "var(--text)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {font.family}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>{font.category}</span>
      </span>
      {selected && <Check size={14} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />}
    </button>
  );
}
