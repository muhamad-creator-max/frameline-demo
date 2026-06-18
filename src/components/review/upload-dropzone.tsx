"use client";

import * as React from "react";
import { UploadCloud, Loader2, Film, ImageIcon, Music } from "lucide-react";
import { useReviewUpload } from "@/lib/review/use-upload";
import { UploadStatusBar } from "./upload-status-bar";

/**
 * Drag-and-drop / click uploader for NEW assets. Upload logic lives in
 * `useReviewUpload` (shared with drag-to-version on asset cards).
 */
export function UploadDropzone({
  projectId,
  folderId,
}: {
  projectId: string;
  folderId: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const { upload, items, busy } = useReviewUpload(projectId);

  function handleFiles(files: FileList | File[]) {
    void upload(files, { folderId });
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border-2)"}`,
          background: dragOver ? "var(--accent-weak)" : "var(--surface-2)",
          borderRadius: "var(--r-md)",
          padding: "22px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          transition: "background .12s ease, border-color .12s ease",
        }}
      >
        <UploadCloud size={22} style={{ color: "var(--text-3)" }} />
        <span style={{ fontSize: 13, color: "var(--text-2)" }}>
          Drop video, image, or audio here, or <strong style={{ color: "var(--accent-ink)" }}>browse</strong>
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)", display: "inline-flex", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Film size={12} /> MP4/MOV</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ImageIcon size={12} /> JPG/PNG</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Music size={12} /> MP3/WAV</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => (
            <div
              key={it.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--text-2)",
                background: "var(--surface)",
                border: "1px solid var(--border-raw)",
                borderRadius: 7,
                padding: "6px 10px",
              }}
            >
              {it.status === "uploading" || it.status === "processing" ? (
                <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />
              ) : it.status === "error" ? (
                <span style={{ color: "var(--danger)" }}>✕</span>
              ) : (
                <span style={{ color: "var(--accent)" }}>✓</span>
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
              <span style={{ color: "var(--text-3)" }}>
                {it.status === "uploading" ? `${it.progress}%` : it.status === "processing" ? "processing…" : it.status === "error" ? "failed" : "done"}
              </span>
            </div>
          ))}
        </div>
      )}

      {busy && (
        <p style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-3)" }}>
          Keep this tab open until uploads finish.
        </p>
      )}

      {/* Fixed bottom-left radial progress + ETA. */}
      <UploadStatusBar items={items} />
    </div>
  );
}
