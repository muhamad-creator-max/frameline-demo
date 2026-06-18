"use client";

import * as React from "react";
import { toast } from "sonner";
import { Lock, ArrowRight, Folder, Film, ImageIcon, Music, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { FrameMark } from "@/components/brand/frame-mark";
import { formatTimecode } from "@/lib/review/coords";
import type { AssetDTO, CreateCommentInput, ProjectDTO } from "@/lib/review/types";
import { ReviewWorkspace, type ReviewApi } from "./review-workspace";

interface SharedAsset {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  folderId: string | null;
  currentVersion: number;
  status: string;
  thumbnailUrl: string | null;
  durationS: number | null;
}
interface SharedFolder {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
}
interface UnlockedPayload {
  project: { id: string; name: string; description: string | null; allowDownload: boolean };
  folders: SharedFolder[];
  assets: SharedAsset[];
}

type Stage = "password" | "name" | "browse" | "asset";

export function GuestFlow({
  slug,
  projectName,
  requiresPassword,
  initial,
  initialGuestName,
}: {
  slug: string;
  projectName: string;
  requiresPassword: boolean;
  initial: UnlockedPayload | null;
  initialGuestName: string | null;
}) {
  const [stage, setStage] = React.useState<Stage>(
    requiresPassword && !initial ? "password" : initialGuestName ? "browse" : "name",
  );
  const [data, setData] = React.useState<UnlockedPayload | null>(initial);
  const [guestName, setGuestName] = React.useState(initialGuestName ?? "");
  const [currentFolder, setCurrentFolder] = React.useState<string | null>(null);
  const [openAsset, setOpenAsset] = React.useState<AssetDTO | null>(null);

  // Guest API implementation (public endpoints).
  const api = React.useMemo<ReviewApi>(
    () => ({
      async loadComments(versionId) {
        const res = await fetch(`/api/review/r/${slug}/comments?versionId=${versionId}`, { cache: "no-store" });
        if (!res.ok) {
          const msg = await res.json().then((j) => j.error).catch(() => null);
          throw new Error(`${res.status} ${msg ?? "load failed"}`);
        }
        return res.json();
      },
      async createComment(input: CreateCommentInput) {
        const res = await fetch(`/api/review/r/${slug}/comments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error("create failed");
      },
      async deleteComment(commentId) {
        const res = await fetch(`/api/review/r/${slug}/comments/${commentId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
      },
      async editComment(commentId, body) {
        const res = await fetch(`/api/review/r/${slug}/comments/${commentId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) throw new Error("edit failed");
      },
      // guests can't change status or edit others' annotations
    }),
    [slug],
  );

  async function openAssetById(assetId: string) {
    const res = await fetch(`/api/review/r/${slug}/asset/${assetId}`, { cache: "no-store" });
    if (!res.ok) {
      toast.error("Could not open this file");
      return;
    }
    const { asset } = await res.json();
    setOpenAsset(asset);
    setStage("asset");
  }

  // ── stages ──
  if (stage === "asset" && openAsset && data) {
    const projectDTO: ProjectDTO = {
      id: data.project.id,
      name: data.project.name,
      description: data.project.description,
      shareSlug: slug,
      hasPassword: requiresPassword,
      allowDownload: data.project.allowDownload,
      viewCount: 0,
    };
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <GuestTopBar
          name={guestName}
          onBack={() => {
            setOpenAsset(null);
            setStage("browse");
          }}
          backLabel={data.project.name}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReviewWorkspace
            asset={openAsset}
            mode="guest"
            api={api}
            shareSlug={slug}
            allowDownload={data.project.allowDownload}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 50 }}>
      <div style={{ height: 56, padding: "0 24px", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <FrameMark />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {stage === "password" && (
          <PasswordGate
            slug={slug}
            projectName={projectName}
            onUnlock={(payload) => {
              setData(payload);
              setStage(guestName ? "browse" : "name");
            }}
          />
        )}

        {stage === "name" && (
          <NameGate
            projectName={projectName}
            slug={slug}
            onIdentified={(name) => {
              setGuestName(name);
              setStage("browse");
            }}
          />
        )}

        {stage === "browse" && data && (
          <BrowseView
            data={data}
            currentFolder={currentFolder}
            onFolder={setCurrentFolder}
            onOpenAsset={openAssetById}
          />
        )}
      </div>
    </div>
  );
}

function GuestTopBar({ name, onBack, backLabel }: { name: string; onBack: () => void; backLabel: string }) {
  return (
    <div
      style={{
        height: 52,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid var(--border-raw)",
        flexShrink: 0,
        background: "var(--bg)",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          color: "var(--text-2)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>
      <div style={{ flex: 1 }} />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12.5,
          color: "var(--text-2)",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {(name[0] ?? "?").toUpperCase()}
        </span>
        {name}
      </span>
    </div>
  );
}

function PasswordGate({
  slug,
  projectName,
  onUnlock,
}: {
  slug: string;
  projectName: string;
  onUnlock: (payload: UnlockedPayload) => void;
}) {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/review/r/${slug}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wrong password");
      onUnlock(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Lock size={26} style={{ color: "var(--accent)" }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "14px 0 4px" }}>{projectName}</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 18px" }}>
        This review is password protected.
      </p>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, width: "100%" }}>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          style={inputStyle}
        />
        <button type="submit" disabled={busy || !password} style={primaryBtn(busy || !password)}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
        </button>
      </form>
    </Centered>
  );
}

function NameGate({
  slug,
  projectName,
  onIdentified,
}: {
  slug: string;
  projectName: string;
  onIdentified: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/review/r/${slug}/identify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      onIdentified(name.trim());
    } catch {
      toast.error("Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>{projectName}</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 18px" }}>
        Enter your name so the team knows who left each comment.
      </p>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, width: "100%" }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={inputStyle}
        />
        <button type="submit" disabled={busy || !name.trim()} style={primaryBtn(busy || !name.trim())}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
        </button>
      </form>
    </Centered>
  );
}

function BrowseView({
  data,
  currentFolder,
  onFolder,
  onOpenAsset,
}: {
  data: UnlockedPayload;
  currentFolder: string | null;
  onFolder: (id: string | null) => void;
  onOpenAsset: (id: string) => void;
}) {
  const childFolders = data.folders.filter((f) => f.parentId === currentFolder);
  const folderAssets = data.assets.filter((a) => a.folderId === currentFolder);

  const breadcrumb = React.useMemo(() => {
    const trail: SharedFolder[] = [];
    let id = currentFolder;
    while (id) {
      const f = data.folders.find((x) => x.id === id);
      if (!f) break;
      trail.unshift(f);
      id = f.parentId;
    }
    return trail;
  }, [currentFolder, data.folders]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 24px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 18, fontSize: 14 }}>
        <button
          type="button"
          onClick={() => onFolder(null)}
          style={{ fontWeight: 700, background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, fontSize: 18 }}
        >
          {data.project.name}
        </button>
        {breadcrumb.map((f) => (
          <React.Fragment key={f.id}>
            <ChevronRight size={15} style={{ color: "var(--text-3)" }} />
            <button
              type="button"
              onClick={() => onFolder(f.id)}
              style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", padding: 0, fontSize: 14 }}
            >
              {f.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {childFolders.length === 0 && folderAssets.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 14, padding: "48px 0" }}>
          Nothing here yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {childFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFolder(f.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 16,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-raw)",
                background: "var(--surface)",
                cursor: "pointer",
                textAlign: "start",
              }}
            >
              <Folder size={20} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{f.name}</span>
            </button>
          ))}

          {folderAssets.map((a) => {
            const Icon = a.kind === "video" ? Film : a.kind === "audio" ? Music : ImageIcon;
            const ready = a.status === "ready";
            return (
              <button
                key={a.id}
                type="button"
                disabled={!ready}
                onClick={() => onOpenAsset(a.id)}
                style={{
                  display: "block",
                  textAlign: "start",
                  padding: 0,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border-raw)",
                  background: "var(--surface)",
                  overflow: "hidden",
                  cursor: ready ? "pointer" : "default",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16 / 10",
                    background: a.thumbnailUrl ? `center / cover no-repeat url(${a.thumbnailUrl})` : "var(--surface-2)",
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                  }}
                >
                  {!a.thumbnailUrl && <Icon size={26} style={{ color: "var(--text-3)" }} />}
                  {a.durationS != null && ready && (
                    <span
                      style={{
                        position: "absolute",
                        insetBlockEnd: 6,
                        insetInlineEnd: 6,
                        padding: "1px 6px",
                        borderRadius: 5,
                        background: "rgba(0,0,0,.7)",
                        color: "#fff",
                        fontSize: 11,
                      }}
                    >
                      {formatTimecode(a.durationS)}
                    </span>
                  )}
                  {!ready && (
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.4)", color: "#fff", fontSize: 12 }}>
                      processing…
                    </span>
                  )}
                </div>
                <div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon size={13} style={{ color: "var(--text-3)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100%", padding: 24 }}>
      <div style={{ width: "min(420px, 100%)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 9,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 44,
    borderRadius: 9,
    border: "none",
    background: disabled ? "var(--surface-2)" : "var(--accent)",
    color: disabled ? "var(--text-3)" : "var(--accent-contrast)",
    cursor: disabled ? "default" : "pointer",
  };
}
