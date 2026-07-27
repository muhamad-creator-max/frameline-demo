"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Inbox, Share2, Copy, Check, ExternalLink, Lock } from "lucide-react";
import { useWorkflow } from "@/lib/workflow/store";
import { absoluteUrl } from "@/lib/utils";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

export function TopBar({ onPreview }: { onPreview: () => void }) {
  const project = useWorkflow((s) => s.project);
  const nodes = useWorkflow((s) => s.nodes);
  const edges = useWorkflow((s) => s.edges);
  const camera = useWorkflow((s) => s.camera);
  const dirty = useWorkflow((s) => s.dirty);
  const setMeta = useWorkflow((s) => s.setMeta);
  const markClean = useWorkflow((s) => s.markClean);

  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  // Status pill reflects publish state + unsaved edits.
  const published = project?.status === "published";
  const statusLabel = dirty ? "Unsaved" : published ? "Published" : "Draft";
  const statusDot = dirty ? "#f59e0b" : published ? "var(--accent)" : "var(--text-3)";

  async function save(publish: boolean) {
    if (!project) return;
    publish ? setPublishing(true) : setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: { title: project.title, description: project.description },
          canvas: camera,
          nodes: nodes.map((n) => ({
            id: n.id,
            kind: n.kind,
            x: n.x,
            y: n.y,
            w: n.w,
            h: n.h,
            data: n.data,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source_node_id: e.source_node_id,
            source_port: e.source_port,
            target_node_id: e.target_node_id,
            target_port: e.target_port,
            label: e.label,
          })),
          publish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      markClean();
      if (publish) {
        setMeta({ status: "published" });
        toast.success("Published — clients can open the link");
      } else {
        toast.success("Saved");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      publish ? setPublishing(false) : setSaving(false);
    }
  }


  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
        borderBottom: "1px solid var(--border-raw)",
        background: "var(--bg)",
        zIndex: 30,
      }}
    >
      {/* Breadcrumb: ← WORKFLOWS / project name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Link href="/app/workflows" aria-label="Back to workflows" style={{ display: "inline-flex", color: "var(--text-3)", textDecoration: "none" }}>
          <ArrowLeft size={16} />
        </Link>
        <Link
          href="/app/workflows"
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textDecoration: "none" }}
        >
          Workflows
        </Link>
        <span style={{ color: "var(--border-2)" }}>/</span>
        <input
          value={project?.title ?? ""}
          onChange={(e) => setMeta({ title: e.target.value })}
          placeholder="Untitled workflow"
          style={{
            fontSize: 14, fontWeight: 600, color: "var(--text)",
            background: "transparent", border: "1px solid transparent",
            borderRadius: 6, padding: "4px 6px", minWidth: 100, maxWidth: 320,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-2)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status pill with dot */}
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 999,
            background: "var(--surface-2)", border: "1px solid var(--border-raw)",
            fontFamily: MONO, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.05em", color: "var(--text-2)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 99, background: statusDot }} />
          {statusLabel}
        </span>

        {project && (
          <Link href={`/app/workflows/${project.id}/responses`} style={{ ...ghostBtn, textDecoration: "none" }}>
            <Inbox size={14} /> Responses
          </Link>
        )}

        <button onClick={onPreview} style={ghostBtn}>Live Preview</button>

        {project && <SharePopover />}

        <button onClick={() => save(false)} disabled={saving} style={ghostBtn}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save
        </button>

        <button onClick={() => save(true)} disabled={publishing} style={darkBtn}>
          {publishing ? <Loader2 size={14} className="animate-spin" /> : null}
          Publish
        </button>
      </div>
    </header>
  );
}

/**
 * Share the client link for this workflow. The list page has a per-row copy
 * action; this is the same link, reachable without leaving the canvas.
 *
 * The public page only ever serves a PUBLISHED snapshot (see /w/[slug]), so the
 * panel is explicit about that: the link exists from the moment the workflow is
 * created, but it 404s until the first publish, and clients keep seeing the last
 * published version while you edit.
 */
function SharePopover() {
  const project = useWorkflow((s) => s.project);
  const dirty = useWorkflow((s) => s.dirty);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!project) return null;
  const slug = project.share_slug ?? "";
  const url = slug ? absoluteUrl(`/w/${slug}`) : "";
  const published = project.status === "published";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable on insecure origins — let them copy manually.
      toast.error("Couldn't copy — select the link and copy it");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={ghostBtn} aria-expanded={open}>
        <Share2 size={14} /> Share
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 60,
            width: 340, padding: 14, borderRadius: 14,
            background: "var(--surface)", border: "1px solid var(--border-raw)",
            boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
            Client link
          </div>

          {slug ? (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 11,
                    border: "1px solid var(--border-raw)", borderRadius: 8, padding: "7px 9px",
                    background: "var(--surface-2)", color: "var(--text-2)", outline: "none",
                  }}
                />
                <button onClick={copy} style={{ ...darkBtn, padding: "8px 12px" }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-ink)", textDecoration: "none" }}
              >
                <ExternalLink size={12} /> Open the client view
              </a>

              <p style={{ fontSize: 11.5, lineHeight: 1.55, color: published ? "var(--text-3)" : "#b45309" }}>
                {published
                  ? dirty
                    ? "Clients see the last published version — publish again to send your latest edits."
                    : "Live. No account needed: your client enters a name and answers."
                  : "Not published yet — this link won't open until you hit Publish."}
              </p>

              {project.password_hash && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-3)" }}>
                  <Lock size={12} /> Password protected
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>
              No link yet — save the workflow to generate one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 10,
  background: "var(--surface)", color: "var(--text)",
  border: "1px solid var(--border-raw)", cursor: "pointer",
  fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
};

const darkBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 10,
  background: "var(--text)", color: "var(--bg)",
  border: "1px solid transparent", cursor: "pointer",
  fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
};
