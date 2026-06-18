"use client";

import * as React from "react";
import { RotateCcw, Trash2, FileText, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  label: string;
  deleted_at: string;
  kind: "guideline" | "response";
}

export function TrashList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = React.useState(initial);
  React.useEffect(() => setItems(initial), [initial]);

  async function restore(it: Item) {
    const url = it.kind === "guideline"
      ? `/api/guidelines/${it.id}/trash`
      : `/api/responses/${it.id}/trash`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed"); return; }
    setItems((a) => a.filter((x) => x.id !== it.id));
    toast.success("Restored");
  }

  async function purge(it: Item) {
    if (!confirm("Delete permanently? This cannot be undone.")) return;
    if (it.kind === "response") {
      // No dedicated purge for responses — let the 30-day cron handle it.
      toast.message("Will be auto-deleted within 30 days.");
      return;
    }
    const res = await fetch(`/api/guidelines/${it.id}/purge`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed"); return; }
    setItems((a) => a.filter((x) => x.id !== it.id));
    toast.success("Deleted permanently");
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 32px 80px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Trash</h1>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 22 }}>
          Items in trash are deleted permanently after 30 days.
        </p>

        {items.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-raw)",
              borderRadius: "var(--r-md)",
              padding: "44px 24px",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            Trash is empty.
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-raw)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            {items.map((it, idx) => {
              const days = Math.max(
                0,
                30 - Math.floor((Date.now() - new Date(it.deleted_at).getTime()) / 86_400_000),
              );
              return (
                <div
                  key={`${it.kind}-${it.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--border-raw)",
                  }}
                >
                  {it.kind === "guideline"
                    ? <FileText size={14} style={{ color: "var(--text-3)" }} />
                    : <Inbox size={14} style={{ color: "var(--text-3)" }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.label}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {days}d left
                  </span>
                  <button onClick={() => restore(it)} style={chip("default")}>
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button onClick={() => purge(it)} style={chip("danger")}>
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function chip(kind: "default" | "danger"): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "4px 9px", borderRadius: 99,
    fontSize: 11.5, fontWeight: 500,
    background: kind === "danger" ? "rgba(229,72,77,.08)" : "var(--bg-2)",
    color: kind === "danger" ? "var(--danger)" : "var(--text-2)",
    border: "1px solid transparent", cursor: "pointer",
  };
}
