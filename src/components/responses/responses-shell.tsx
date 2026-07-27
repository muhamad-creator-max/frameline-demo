"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";

interface Resp {
  id: string;
  guideline_id: string;
  client_name: string;
  status: "in_progress" | "submitted";
  submitted: string;
  done: boolean;
}

export function ResponsesShell({
  guidelines,
  initialResponses,
}: {
  guidelines: { id: string; title: string }[];
  initialResponses: Resp[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const guidelineId = params.get("g") ?? guidelines[0]?.id ?? "";

  const filtered = initialResponses.filter((r) => (guidelineId ? r.guideline_id === guidelineId : true));
  const [selId, setSelId] = React.useState<string | null>(filtered[0]?.id ?? null);

  React.useEffect(() => {
    setSelId(filtered[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidelineId]);

  React.useEffect(() => {
    if (selId) router.push(`/app/responses/${selId}`);
  }, [selId, router]);

  if (initialResponses.length === 0) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center", color: "var(--text-3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: "var(--accent-weak)", color: "var(--accent-ink)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Inbox size={26} />
          </div>
          <h2 style={{ fontSize: 18, color: "var(--text)" }}>No responses yet</h2>
          <p style={{ fontSize: 14 }}>Share a brief link with your client to start collecting answers.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside
        style={{
          width: 280, flexShrink: 0,
          borderInlineEnd: "1px solid var(--border-raw)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 18px 12px" }}>
          {guidelines.length > 1 && (
            <select
              value={guidelineId}
              onChange={(e) => router.push(`/app/responses?g=${e.target.value}`)}
              style={{
                width: "100%", padding: "8px 10px",
                background: "var(--surface)", border: "1px solid var(--border-2)",
                borderRadius: "var(--r-md)", fontSize: 13, color: "var(--text)",
                marginBottom: 10,
              }}
            >
              {guidelines.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {filtered.length} {filtered.length === 1 ? "response" : "responses"}
          </div>
          <h3 style={{ fontSize: 15, lineHeight: 1.3 }}>
            {guidelines.find((g) => g.id === guidelineId)?.title ?? "All briefs"}
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((r) => {
            const selected = selId === r.id;
            const initials = r.client_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={r.id}
                onClick={() => setSelId(r.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, borderRadius: "var(--r-md)", textAlign: "start",
                  border: "1px solid",
                  background: selected ? "var(--surface)" : "transparent",
                  borderColor: selected ? "var(--border-2)" : "transparent",
                  boxShadow: selected ? "var(--shadow-sm)" : "none",
                  cursor: "pointer", transition: "all .14s ease",
                }}
              >
                <span
                  style={{
                    width: 38, height: 38, borderRadius: 99,
                    background: "var(--bg-2)", color: "var(--text-2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 14, flexShrink: 0,
                  }}
                >
                  {initials || "?"}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block", fontWeight: 600, fontSize: 14,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: "var(--text)",
                    }}
                  >
                    {r.client_name}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {r.submitted}
                  </span>
                </span>
                {r.done && (
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 99,
                      background: "var(--success)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Detail pane is rendered by the [id] route — until we navigate, show a hint */}
      <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
        <span style={{ fontSize: 13 }}>Select a response to view answers</span>
      </div>
    </div>
  );
}
