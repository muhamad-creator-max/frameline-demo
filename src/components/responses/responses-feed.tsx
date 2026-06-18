"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Copy as CopyIcon, Trash2, Inbox, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { absoluteUrl } from "@/lib/utils";

interface Item {
  id: string;
  client_name: string;
  status: "in_progress" | "submitted";
  guideline_id: string;
  guideline_title: string;
  share_slug: string;
  at: string;
}

export function ResponsesFeed({ items: initial }: { items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  React.useEffect(() => setItems(initial), [initial]);

  async function trash(it: Item) {
    const res = await fetch(`/api/responses/${it.id}/trash`, { method: "POST" });
    if (!res.ok) { toast.error("Failed"); return; }
    setItems((arr) => arr.filter((x) => x.id !== it.id));
    toast.success("Moved to trash");
  }
  async function copyLink(it: Item) {
    await navigator.clipboard.writeText(absoluteUrl(`/c/${it.share_slug}`));
    toast.success("Share link copied");
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 32px 80px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 22 }}>Responses</h1>

        {items.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-raw)",
              borderRadius: "var(--r-md)",
              padding: "60px 24px",
              textAlign: "center",
              color: "var(--text-2)",
            }}
          >
            <Inbox size={22} style={{ marginBottom: 10, color: "var(--text-3)" }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No responses yet</h2>
            <p style={{ fontSize: 13 }}>Share a brief link with your client to start collecting answers.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it) => (
              <FeedRow
                key={it.id}
                it={it}
                onOpen={() => router.push(`/app/responses/${it.id}`)}
                onCopyLink={() => copyLink(it)}
                onTrash={() => trash(it)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedRow({
  it, onOpen, onCopyLink, onTrash,
}: {
  it: Item;
  onOpen: () => void;
  onCopyLink: () => void;
  onTrash: () => void;
}) {
  const initials = it.client_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <span
        style={{
          width: 34, height: 34, borderRadius: 99,
          background: "var(--accent-weak)", color: "var(--accent-ink)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 600, fontSize: 12.5, flexShrink: 0,
        }}
      >
        {initials || "?"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--text)" }}>
          <strong style={{ fontWeight: 600 }}>{it.client_name}</strong>
          <span style={{ color: "var(--text-2)" }}>
            {it.status === "submitted" ? " submitted " : " started "}
          </span>
          <strong style={{ fontWeight: 500 }}>{it.guideline_title}</strong>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
          {formatDateTime(it.at)}
        </div>
      </div>
      <button
        onClick={onOpen}
        style={{
          padding: "6px 12px",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--r-md)",
          fontSize: 12.5, fontWeight: 500, cursor: "pointer",
        }}
      >
        View
      </button>
      <RowMenu onCopyLink={onCopyLink} onTrash={onTrash} />
    </div>
  );
}

function RowMenu({
  onCopyLink, onTrash,
}: { onCopyLink: () => void; onTrash: () => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28, height: 28, borderRadius: 5,
          background: open ? "var(--bg-2)" : "transparent",
          color: "var(--text-2)", border: "none", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", insetBlockStart: "100%", insetInlineEnd: 0,
            background: "var(--surface)", border: "1px solid var(--border-raw)",
            borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)",
            padding: 5, marginBlockStart: 4, minWidth: 170, zIndex: 50,
          }}
        >
          <Item icon={<CopyIcon size={13} />} onClick={() => { setOpen(false); onCopyLink(); }}>
            Copy share link
          </Item>
          <Item icon={<Trash2 size={13} />} danger onClick={() => { setOpen(false); onTrash(); }}>
            Delete response
          </Item>
        </div>
      )}
    </div>
  );
}

function Item({
  icon, children, onClick, danger,
}: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: "6px 9px", borderRadius: 5,
        background: "transparent", color: danger ? "var(--danger)" : "var(--text)",
        fontSize: 12.5, textAlign: "start", border: "none", cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(229,72,77,.08)" : "rgba(0,0,0,.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon} {children}
    </button>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
