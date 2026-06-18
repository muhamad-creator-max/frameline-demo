"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, MoreHorizontal, Copy as CopyIcon, Trash2, Edit2, CopyPlus, Lock,
  Eye, ExternalLink, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { absoluteUrl } from "@/lib/utils";

interface Row {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  share_slug: string;
  current_version: number;
  view_count: number;
  updated_at: string;
  question_count: number;
}

export function GuidelinesPageClient({
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

  async function createGuideline() {
    setCreating(true);
    try {
      const res = await fetch("/api/guidelines", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/app/guidelines/${json.id}`);
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
    const res = await fetch(`/api/guidelines/${row.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed");
      return;
    }
    patchRow(row.id, { status: next });
    toast.success(next === "published" ? "Set to public" : "Set to private");
  }

  async function copyLink(row: Row) {
    await navigator.clipboard.writeText(absoluteUrl(`/c/${row.share_slug}`));
    toast.success("Link copied");
  }

  async function trash(row: Row) {
    const res = await fetch(`/api/guidelines/${row.id}/trash`, { method: "POST" });
    if (!res.ok) { toast.error("Failed"); return; }
    removeRow(row.id);
    toast.success("Moved to trash");
  }

  async function duplicate(row: Row) {
    const res = await fetch(`/api/guidelines/${row.id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    router.push(`/app/guidelines/${json.id}`);
  }

  async function rename(row: Row, title: string) {
    const res = await fetch(`/api/guidelines/${row.id}/rename`, {
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
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Guidelines</h1>
            {featured && (
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                <strong style={{ color: "var(--text)", fontWeight: 500 }}>{featured.title}</strong>
                <span> · {featured.question_count} questions · {featured.view_count} views</span>
              </p>
            )}
          </div>
          <button
            onClick={createGuideline}
            disabled={creating}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px",
              borderRadius: "var(--r-md)",
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: "1px solid transparent",
              boxShadow: "var(--glow)",
              fontWeight: 500, fontSize: 13,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            New Guideline
          </button>
        </div>

        {rows.length === 0 ? (
          <Empty onCreate={createGuideline} />
        ) : (
          <>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-raw)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 100px 90px 80px 130px 40px",
                  padding: "9px 16px",
                  borderBottom: "1px solid var(--border-raw)",
                  fontSize: 11, fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: ".06em",
                  background: "var(--surface-2)",
                }}
              >
                <span>Name</span>
                <span>Status</span>
                <span style={{ textAlign: "center" }}>Questions</span>
                <span style={{ textAlign: "center" }}>Views</span>
                <span>Updated</span>
                <span />
              </div>
              {rows.map((row) => (
                <GuidelineRow
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
                <PageBtn disabled={page <= 1} onClick={() => router.push(`/app/guidelines?page=${page - 1}`)}>
                  <ChevronLeft size={13} /> Prev
                </PageBtn>
                <span style={{ fontSize: 12, color: "var(--text-2)", alignSelf: "center", padding: "0 8px" }}>
                  Page {page} of {totalPages}
                </span>
                <PageBtn disabled={page >= totalPages} onClick={() => router.push(`/app/guidelines?page=${page + 1}`)}>
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

function GuidelineRow({
  row,
  onToggleStatus,
  onCopyLink,
  onTrash,
  onDuplicate,
  onRename,
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

  function submit() {
    if (draft.trim() && draft.trim() !== row.title) onRename(draft.trim());
    setRenaming(false);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 100px 90px 80px 130px 40px",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-raw)",
        fontSize: 13,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ minWidth: 0 }}>
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setDraft(row.title); setRenaming(false); } }}
            style={{
              width: "100%", padding: "4px 6px", fontSize: 13.5, fontWeight: 500,
              borderRadius: 4, border: "1px solid var(--accent)", background: "var(--surface)", color: "var(--text)",
            }}
          />
        ) : (
          <Link
            href={`/app/guidelines/${row.id}`}
            style={{
              color: "var(--text)", textDecoration: "none",
              fontSize: 13.5, fontWeight: 500,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {row.title || "Untitled"}
          </Link>
        )}
      </div>

      <button onClick={onToggleStatus} style={statusPillStyle(row.status)}>
        {row.status === "published" ? "Public" : row.status === "draft" ? "Private" : "Archived"}
      </button>

      <span className="mono" style={{ textAlign: "center", color: "var(--text-2)", fontSize: 12 }}>
        {row.question_count}
      </span>
      <span className="mono" style={{ textAlign: "center", color: "var(--text-2)", fontSize: 12 }}>
        {row.view_count}
      </span>
      <span style={{ color: "var(--text-3)", fontSize: 12 }}>
        {formatRelative(row.updated_at)}
      </span>

      <RowMenu
        onCopyLink={onCopyLink}
        onTrash={onTrash}
        onDuplicate={onDuplicate}
        onRename={() => { setDraft(row.title); setRenaming(true); }}
        onSetPassword={() => { window.location.href = `/app/guidelines/${row.id}#share`; }}
        onOpen={() => { window.open(`/c/${row.share_slug}`, "_blank"); }}
      />
    </div>
  );
}

function RowMenu({
  onCopyLink, onTrash, onDuplicate, onRename, onSetPassword, onOpen,
}: {
  onCopyLink: () => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onSetPassword: () => void;
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
        style={{
          width: 28, height: 28, borderRadius: 5,
          background: open ? "var(--bg-2)" : "transparent", color: "var(--text-2)",
          border: "none", cursor: "pointer",
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
            padding: 5, marginBlockStart: 4, minWidth: 180, zIndex: 50,
          }}
        >
          <MenuItem icon={<Edit2 size={13} />} onClick={() => { setOpen(false); onRename(); }}>Rename</MenuItem>
          <MenuItem icon={<CopyPlus size={13} />} onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate</MenuItem>
          <MenuItem icon={<CopyIcon size={13} />} onClick={() => { setOpen(false); onCopyLink(); }}>Copy share link</MenuItem>
          <MenuItem icon={<ExternalLink size={13} />} onClick={() => { setOpen(false); onOpen(); }}>Open as client</MenuItem>
          <MenuItem icon={<Lock size={13} />} onClick={() => { setOpen(false); onSetPassword(); }}>Set password</MenuItem>
          <div style={{ height: 1, background: "var(--border-raw)", margin: "4px 2px" }} />
          <MenuItem icon={<Trash2 size={13} />} danger onClick={() => { setOpen(false); onTrash(); }}>
            Move to trash
          </MenuItem>
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

function statusPillStyle(status: Row["status"]): React.CSSProperties {
  const styles: Record<Row["status"], { bg: string; fg: string }> = {
    published: { bg: "var(--accent-weak)", fg: "var(--accent-ink)" },
    draft:     { bg: "var(--bg-2)",         fg: "var(--text-2)" },
    archived:  { bg: "var(--bg-2)",         fg: "var(--text-3)" },
  };
  const s = styles[status];
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: s.bg, color: s.fg,
    fontSize: 11, fontWeight: 500,
    padding: "3px 9px", borderRadius: 99,
    border: "1px solid transparent",
    cursor: "pointer", justifySelf: "start",
    textTransform: "capitalize",
  };
}

function PageBtn({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "6px 12px", borderRadius: "var(--r-md)",
        background: "var(--surface)", color: disabled ? "var(--text-3)" : "var(--text)",
        border: "1px solid var(--border-raw)",
        fontSize: 12, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex", width: 44, height: 44, borderRadius: 12,
          background: "var(--accent-weak)", color: "var(--accent-ink)",
          alignItems: "center", justifyContent: "center", marginBottom: 12,
        }}
      >
        <Plus size={22} />
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No guidelines yet</h2>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
        Create your first visual brief — it takes about 2 minutes.
      </p>
      <button
        onClick={onCreate}
        style={{
          padding: "7px 14px", borderRadius: "var(--r-md)",
          background: "var(--accent)", color: "var(--accent-contrast)",
          border: "1px solid transparent", boxShadow: "var(--glow)",
          fontWeight: 500, fontSize: 12.5, cursor: "pointer",
        }}
      >
        New Guideline
      </button>
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
