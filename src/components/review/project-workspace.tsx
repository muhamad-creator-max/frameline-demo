"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Film,
  ImageIcon,
  Music,
  Loader2,
  Share2,
  MoreHorizontal,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTimecode } from "@/lib/review/coords";
import { useReviewUpload } from "@/lib/review/use-upload";
import type { AssetCardDTO, FolderDTO, ProjectDTO } from "@/lib/review/types";
import { UploadDropzone } from "./upload-dropzone";
import { ReviewShareDialog } from "./share-dialog";
import { CircularProgress } from "./circular-progress";
import { formatEta } from "./upload-status-bar";

export function ProjectWorkspace({
  project,
  folders,
  assets,
}: {
  project: ProjectDTO;
  folders: FolderDTO[];
  assets: AssetCardDTO[];
}) {
  const router = useRouter();
  const [currentFolder, setCurrentFolder] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);

  const childFolders = folders.filter((f) => f.parentId === currentFolder);
  const folderAssets = assets.filter((a) => a.folderId === currentFolder);

  const breadcrumb = React.useMemo(() => {
    const trail: FolderDTO[] = [];
    let id = currentFolder;
    while (id) {
      const f = folders.find((x) => x.id === id);
      if (!f) break;
      trail.unshift(f);
      id = f.parentId;
    }
    return trail;
  }, [currentFolder, folders]);

  async function createFolder() {
    const name = window.prompt("Folder name", "New folder");
    if (!name) return;
    const res = await fetch("/api/review/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, parentId: currentFolder, name }),
    });
    if (res.ok) {
      router.refresh();
    } else toast.error("Failed to create folder");
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and its subfolders? Assets move to the project root.")) return;
    const res = await fetch(`/api/review/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (currentFolder === id) setCurrentFolder(null);
      router.refresh();
    } else toast.error("Failed to delete folder");
  }

  async function trashAsset(id: string) {
    const res = await fetch(`/api/review/assets/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else toast.error("Failed to delete");
  }

  return (
    <div style={{ display: "flex", height: "100%", minWidth: 0 }}>
      {/* folder rail */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderInlineEnd: "1px solid var(--border-raw)",
          background: "var(--bg-2)",
          padding: 10,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" }}>
            Folders
          </span>
          <button
            type="button"
            onClick={createFolder}
            title="New folder"
            style={{ border: "none", background: "transparent", color: "var(--text-2)", cursor: "pointer", padding: 2 }}
          >
            <FolderPlus size={15} />
          </button>
        </div>

        <FolderRailItem label="All files" active={currentFolder === null} onClick={() => setCurrentFolder(null)} icon={<Folder size={14} />} />
        <FolderTree
          folders={folders}
          parentId={null}
          current={currentFolder}
          depth={0}
          onSelect={setCurrentFolder}
          onDelete={deleteFolder}
        />
      </aside>

      {/* main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-raw)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, flex: 1 }}>
            <Link href="/app/review" style={{ fontSize: 14, color: "var(--text-2)", textDecoration: "none" }}>
              Review
            </Link>
            <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
            <button
              type="button"
              onClick={() => setCurrentFolder(null)}
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {project.name}
            </button>
            {breadcrumb.map((f) => (
              <React.Fragment key={f.id}>
                <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
                <button
                  type="button"
                  onClick={() => setCurrentFolder(f.id)}
                  style={{ fontSize: 14, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {f.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 13px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Share2 size={14} /> Share
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          <div style={{ marginBottom: 18 }}>
            <UploadDropzone projectId={project.id} folderId={currentFolder} />
          </div>

          {childFolders.length === 0 && folderAssets.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13.5, padding: "40px 0" }}>
              This folder is empty. Upload media above to start a review.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))",
                gap: 14,
              }}
            >
              {childFolders.map((f) => (
                <FolderCard key={f.id} folder={f} onOpen={() => setCurrentFolder(f.id)} />
              ))}

              {folderAssets.map((a) => (
                <AssetCard key={a.id} asset={a} projectId={project.id} onTrash={() => trashAsset(a.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={project.id}
        slug={project.shareSlug}
        hasPassword={project.hasPassword}
        allowDownload={project.allowDownload}
      />
    </div>
  );
}

function FolderTree({
  folders,
  parentId,
  current,
  depth,
  onSelect,
  onDelete,
}: {
  folders: FolderDTO[];
  parentId: string | null;
  current: string | null;
  depth: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const children = folders.filter((f) => f.parentId === parentId);
  return (
    <>
      {children.map((f) => (
        <div key={f.id}>
          <FolderRailItem
            label={f.name}
            active={current === f.id}
            depth={depth}
            icon={<Folder size={14} />}
            onClick={() => onSelect(f.id)}
            onDelete={() => onDelete(f.id)}
          />
          <FolderTree folders={folders} parentId={f.id} current={current} depth={depth + 1} onSelect={onSelect} onDelete={onDelete} />
        </div>
      ))}
    </>
  );
}

function FolderRailItem({
  label,
  active,
  depth = 0,
  icon,
  onClick,
  onDelete,
}: {
  label: string;
  active: boolean;
  depth?: number;
  icon: React.ReactNode;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 6,
        background: active ? "var(--surface)" : "transparent",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        paddingInlineStart: 8 + depth * 12,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 4px",
          border: "none",
          background: "transparent",
          color: active ? "var(--text)" : "var(--text-2)",
          fontSize: 13,
          cursor: "pointer",
          textAlign: "start",
          minWidth: 0,
        }}
      >
        <span style={{ color: active ? "var(--accent)" : "var(--text-3)", display: "inline-flex" }}>{icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete folder"
          style={{ border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer", padding: "2px 6px" }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function FolderCard({ folder, onOpen }: { folder: FolderDTO; onOpen: () => void }) {
  const thumbs = folder.previewThumbs ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "block",
        textAlign: "start",
        padding: 0,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-raw)",
        background: "var(--surface)",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 10",
          background: "var(--surface-2)",
          position: "relative",
          display: "grid",
          gridTemplateColumns: thumbs.length > 1 ? "1fr 1fr" : "1fr",
          gridTemplateRows: thumbs.length > 2 ? "1fr 1fr" : "1fr",
          gap: 2,
        }}
      >
        {thumbs.length === 0 ? (
          <div style={{ display: "grid", placeItems: "center" }}>
            <Folder size={30} style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          thumbs.slice(0, 4).map((t, i) => (
            <div
              key={i}
              style={{
                backgroundImage: `url(${t})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                // when only 3 thumbs, let the first span the left column
                gridColumn: thumbs.length === 3 && i === 0 ? "1 / 2" : undefined,
                gridRow: thumbs.length === 3 && i === 0 ? "1 / 3" : undefined,
              }}
            />
          ))
        )}
      </div>
      <div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7 }}>
        <Folder size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {folder.name}
        </span>
      </div>
    </button>
  );
}

function AssetCard({ asset, projectId, onTrash }: { asset: AssetCardDTO; projectId: string; onTrash: () => void }) {
  const Icon = asset.kind === "video" ? Film : asset.kind === "audio" ? Music : ImageIcon;
  const ready = asset.status === "ready";
  const href = `/app/review/${projectId}/${asset.id}`;

  const { upload, items } = useReviewUpload(projectId);
  const [dragOver, setDragOver] = React.useState(false);
  const nextVersion = asset.currentVersion + 1;

  // The active upload for THIS card (the hook instance is per-card, so any
  // in-flight item belongs to this asset's drag-to-version).
  const active = items.find((i) => i.status === "uploading" || i.status === "processing");

  // Only react to OS file drags (not internal element drags).
  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const card = (
    <div
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer.files.length) {
          void upload(e.dataTransfer.files, { assetId: asset.id, folderId: asset.folderId });
        }
      }}
      style={{
        borderRadius: "var(--r-md)",
        border: dragOver ? "2px dashed var(--accent)" : "1px solid var(--border-raw)",
        background: "var(--surface)",
        overflow: "hidden",
        cursor: ready ? "pointer" : "default",
        position: "relative",
      }}
    >
      {/* Drag-to-version overlay (Frame.io-style). */}
      {dragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            background: "color-mix(in srgb, var(--accent) 50%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--accent-contrast)",
            pointerEvents: "none",
            textAlign: "center",
            padding: 12,
          }}
        >
          <UploadCloud size={24} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Add Version {nextVersion}</span>
          <span style={{ fontSize: 11.5, opacity: 0.9 }}>Drop to upload a new version</span>
        </div>
      )}

      {/* Upload-in-progress overlay (circular progress + label). */}
      {active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 7,
            background: "rgba(0,0,0,.62)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "#fff",
            textAlign: "center",
            padding: 12,
          }}
        >
          <CircularProgress
            value={active.status === "processing" ? undefined : active.progress}
          />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            {active.status === "processing"
              ? "Processing…"
              : active.etaSeconds != null
                ? `${active.progress}% · ${formatEta(active.etaSeconds)} left`
                : `Uploading ${active.progress}%`}
          </span>
          <span style={{ fontSize: 11, opacity: 0.85 }}>Version {nextVersion}</span>
        </div>
      )}

      <div
        style={{
          aspectRatio: "16 / 10",
          background: "var(--surface-2)",
          display: "grid",
          placeItems: "center",
          position: "relative",
          backgroundImage: asset.thumbnailUrl ? `url(${asset.thumbnailUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!asset.thumbnailUrl && <Icon size={28} style={{ color: "var(--text-3)" }} />}
        {!ready && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "rgba(0,0,0,.45)",
              color: "#fff",
              fontSize: 12,
            }}
          >
            <Loader2 size={14} className="animate-spin" /> {asset.status}
          </div>
        )}
        {asset.durationS != null && ready && (
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
              fontFamily: "var(--font-jetbrains-mono, monospace)",
            }}
          >
            {formatTimecode(asset.durationS)}
          </span>
        )}
      </div>
      <div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </span>
        {asset.currentVersion > 1 && (
          <span style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 600 }}>V{asset.currentVersion}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{ border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer", padding: 2 }}
            >
              <MoreHorizontal size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTrash} className="text-[13px] text-destructive focus:text-destructive">
              <Trash2 size={13} className="mr-2" /> Move to trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return ready ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      {card}
    </Link>
  ) : (
    card
  );
}
