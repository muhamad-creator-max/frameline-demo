"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, MoreHorizontal, Copy as CopyIcon, Trash2, Edit2, CopyPlus,
  ExternalLink, ChevronLeft, ChevronRight, Loader2, Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { absoluteUrl } from "@/lib/utils";
import { StatusPill, publishStatusTone, publishStatusLabel } from "@/components/ui/status-pill";
import { CanvasThumbnail, type ThumbNode, type ThumbEdge } from "./canvas-thumbnail";

interface Row {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  share_slug: string;
  current_version: number;
  view_count: number;
  updated_at: string;
  node_count: number;
  /** Real canvas geometry, rendered as the card's thumbnail. */
  thumb: { nodes: ThumbNode[]; edges: ThumbEdge[] };
}

export function WorkflowsPageClient({
  rows: initialRows,
  page,
  pageSize,
  total,
}: {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initialRows);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => setRows(initialRows), [initialRows]);

  const featured = rows[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function createWorkflow() {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/app/workflows/${json.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setCreating(false);
    }
  }

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeRow(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
  }

  async function toggleStatus(row: Row) {
    const next = row.status === "published" ? "draft" : "published";
    const res = await fetch(`/api/workflows/${row.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    patchRow(row.id, { status: next });
    toast.success(next === "published" ? "Set to public" : "Set to private");
  }

  async function copyLink(row: Row) {
    await navigator.clipboard.writeText(absoluteUrl(`/w/${row.share_slug}`));
    toast.success("Link copied");
  }

  async function trash(row: Row) {
    const res = await fetch(`/api/workflows/${row.id}/trash`, { method: "POST" });
    if (!res.ok) { toast.error("Failed"); return; }
    removeRow(row.id);
    toast.success("Moved to trash");
  }

  async function duplicate(row: Row) {
    const res = await fetch(`/api/workflows/${row.id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    router.push(`/app/workflows/${json.id}`);
  }

  async function rename(row: Row, title: string) {
    const res = await fetch(`/api/workflows/${row.id}/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) { toast.error("Failed"); return; }
    patchRow(row.id, { title });
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 32px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="display-title" style={{ ["--display-title-size" as string]: "22px", marginBottom: 6 }}>Workflows</h1>
            {featured ? (
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                <strong style={{ color: "var(--text)", fontWeight: 500 }}>{featured.title}</strong>
                <span> · {featured.node_count} nodes · {featured.view_count} views</span>
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                Build branching question flows on a canvas.
              </p>
            )}
          </div>
          <button onClick={createWorkflow} disabled={creating} className="cv-btn-primary" style={{ flexShrink: 0 }}>
            {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            New Workflow
          </button>
        </div>

        {rows.length === 0 ? (
          <Empty onCreate={createWorkflow} />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
                gap: 16,
              }}
            >
              {rows.map((row) => (
                <WorkflowCard
                  key={row.id}
                  row={row}
                  onToggleStatus={() => toggleStatus(row)}
                  onCopyLink={() => copyLink(row)}
                  onTrash={() => trash(row)}
                  onDuplicate={() => duplicate(row)}
                  onRename={(t) => rename(row, t)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
                <PageBtn disabled={page <= 1} onClick={() => router.push(`/app/workflows?page=${page - 1}`)}>
                  <ChevronLeft size={13} /> Prev
                </PageBtn>
                <span style={{ fontSize: 12, color: "var(--text-2)", alignSelf: "center", padding: "0 8px" }}>
                  Page {page} of {totalPages}
                </span>
                <PageBtn disabled={page >= totalPages} onClick={() => router.push(`/app/workflows?page=${page + 1}`)}>
                  Next <ChevronRight size={13} />
                </PageBtn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const STRIP_H = 108;

function WorkflowCard({
  row, onToggleStatus, onCopyLink, onTrash, onDuplicate, onRename,
}: {
  row: Row;
  onToggleStatus: () => void;
  onCopyLink: () => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onRename: (t: string) => void;
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(row.title);
  const [hover, setHover] = React.useState(false);

  // Measure the preview strip so the thumbnail can scale the graph to fit.
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [stripW, setStripW] = React.useState(0);
  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setStripW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function submit() {
    if (draft.trim() && draft.trim() !== row.title) onRename(draft.trim());
    setRenaming(false);
  }

  return (
    <div
      className="cv-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow .14s ease, transform .14s ease",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? "var(--shadow-lg)" : undefined,
      }}
    >
      {/* Thumbnail of the workflow's actual canvas */}
      <Link href={`/app/workflows/${row.id}`} style={{ textDecoration: "none", display: "block" }}>
        <div
          ref={stripRef}
          className="workflow-dots"
          style={{
            height: STRIP_H,
            background: "var(--canvas)",
            borderBottom: "1px solid var(--border-raw)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {stripW > 0 && (
            <CanvasThumbnail
              nodes={row.thumb.nodes}
              edges={row.thumb.edges}
              width={stripW}
              height={STRIP_H}
            />
          )}
        </div>
      </Link>

      {/* Body */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {renaming ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setDraft(row.title); setRenaming(false); } }}
                style={{ width: "100%", padding: "4px 6px", fontSize: 13.5, fontWeight: 600, borderRadius: 6, border: "1px solid var(--accent)", background: "var(--surface)", color: "var(--text)", outline: "none" }}
              />
            ) : (
              <Link
                href={`/app/workflows/${row.id}`}
                style={{ color: "var(--text)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
              >
                {row.title || "Untitled"}
              </Link>
            )}
            <span className="cv-meta" style={{ fontSize: 9, color: "var(--text-3)" }}>
              {formatRelative(row.updated_at)}
            </span>
          </div>

          <RowMenu
            onCopyLink={onCopyLink}
            onTrash={onTrash}
            onDuplicate={onDuplicate}
            onRename={() => { setDraft(row.title); setRenaming(true); }}
            onOpen={() => { window.open(`/w/${row.share_slug}`, "_blank"); }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
          <StatusPill tone={publishStatusTone(row.status)} onClick={onToggleStatus}>
            {publishStatusLabel(row.status)}
          </StatusPill>
          <span className="cv-meta" style={{ fontSize: 9, color: "var(--text-3)", marginInlineStart: "auto" }}>
            {row.node_count} Nodes · {row.view_count} Views
          </span>
        </div>
      </div>
    </div>
  );
}

function RowMenu({
  onCopyLink, onTrash, onDuplicate, onRename, onOpen,
}: {
  onCopyLink: () => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onOpen: () => void;
}) {
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
    <div ref={ref} style={{ position: "relative", justifySelf: "end" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: 28, height: 28, borderRadius: 5, background: open ? "var(--bg-2)" : "transparent", color: "var(--text-2)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", insetBlockStart: "100%", insetInlineEnd: 0,
            background: "var(--surface)", border: "1px solid var(--border-raw)",
            borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)",
            padding: 5, marginBlockStart: 4, minWidth: 180, zIndex: 50,
          }}
        >
          <MenuItem icon={<Edit2 size={13} />} onClick={() => { setOpen(false); onRename(); }}>Rename</MenuItem>
          <MenuItem icon={<CopyPlus size={13} />} onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate</MenuItem>
          <MenuItem icon={<CopyIcon size={13} />} onClick={() => { setOpen(false); onCopyLink(); }}>Copy share link</MenuItem>
          <MenuItem icon={<ExternalLink size={13} />} onClick={() => { setOpen(false); onOpen(); }}>Open as client</MenuItem>
          <div style={{ height: 1, background: "var(--border-raw)", margin: "4px 2px" }} />
          <MenuItem icon={<Trash2 size={13} />} danger onClick={() => { setOpen(false); onTrash(); }}>Move to trash</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, onClick, children, danger,
}: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "6px 9px", borderRadius: 5,
        background: "transparent", color: danger ? "var(--danger)" : "var(--text)", fontSize: 12.5, textAlign: "start", border: "none", cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(229,72,77,.08)" : "rgba(0,0,0,.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon} {children}
    </button>
  );
}


function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: "var(--r-md)",
        background: "var(--surface)", color: disabled ? "var(--text-3)" : "var(--text)",
        border: "1px solid var(--border-raw)", fontSize: 12, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="cv-card" style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", width: 44, height: 44, borderRadius: 12, background: "var(--accent-weak)", color: "var(--accent-ink)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <WorkflowIcon size={22} />
      </div>
      <h2 className="display-title" style={{ ["--display-title-size" as string]: "15px", marginBottom: 6 }}>No workflows yet</h2>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
        Create a canvas, connect questions into a flow, and share one link with your client.
      </p>
      <button onClick={onCreate} className="cv-btn-primary">New Workflow</button>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
