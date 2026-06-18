"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type UploadKind = "video" | "image" | "audio";

export function classifyFile(file: File): UploadKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Returns a function that, given (loaded, total) progress samples, estimates
 * the seconds remaining. Speed is smoothed with an exponential moving average
 * so the ETA doesn't jitter on every progress event.
 */
function makeEtaTracker() {
  let lastTime = performance.now();
  let lastLoaded = 0;
  let avgBps = 0; // smoothed bytes/sec
  return (loaded: number, total: number): number | undefined => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    const db = loaded - lastLoaded;
    lastTime = now;
    lastLoaded = loaded;
    if (dt <= 0 || db < 0) return avgBps > 0 ? Math.ceil((total - loaded) / avgBps) : undefined;
    const bps = db / dt;
    avgBps = avgBps === 0 ? bps : avgBps * 0.7 + bps * 0.3;
    if (avgBps <= 0) return undefined;
    return Math.ceil((total - loaded) / avgBps);
  };
}

export interface UploadProgress {
  name: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  /** Bytes uploaded / total — used to estimate time remaining. */
  loaded?: number;
  total?: number;
  /** Estimated seconds remaining for the byte transfer (undefined until known). */
  etaSeconds?: number;
}

/**
 * Shared review upload logic. Handles new assets AND new versions (pass
 * `assetId` to add the next version of an existing asset). Videos go to Mux
 * (direct upload + poll); images/audio go to the storage route. Refreshes the
 * router on completion so grids/version switchers update.
 */
export function useReviewUpload(projectId: string) {
  const router = useRouter();
  const [items, setItems] = React.useState<UploadProgress[]>([]);
  const busy = items.some((i) => i.status === "uploading" || i.status === "processing");

  const patch = React.useCallback((name: string, p: Partial<UploadProgress>) => {
    setItems((prev) => prev.map((it) => (it.name === name ? { ...it, ...p } : it)));
  }, []);

  const uploadVideo = React.useCallback(
    async (file: File, opts: { folderId?: string | null; assetId?: string }) => {
      const initRes = await fetch("/api/review/uploads/mux", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, folderId: opts.folderId ?? null, name: file.name, assetId: opts.assetId }),
      });
      if (!initRes.ok) throw new Error("init failed");
      const { uploadUrl, uploadId } = await initRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        const tracker = makeEtaTracker();
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          patch(file.name, {
            progress: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
            etaSeconds: tracker(e.loaded, e.total),
          });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload failed")));
        xhr.onerror = () => reject(new Error("upload failed"));
        xhr.send(file);
      });

      patch(file.name, { status: "processing", progress: 100 });
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await fetch(`/api/review/uploads/status?uploadId=${uploadId}`).then((r) => r.json());
        if (s.status === "ready") return;
        if (s.status === "errored") throw new Error("processing failed");
      }
    },
    [projectId, patch],
  );

  const uploadFile = React.useCallback(
    async (file: File, kind: "image" | "audio", opts: { folderId?: string | null; assetId?: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      if (opts.folderId) fd.append("folderId", opts.folderId);
      if (opts.assetId) fd.append("assetId", opts.assetId);
      fd.append("kind", kind);

      // XHR (not fetch) so we get upload progress + ETA for the status bar.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/review/uploads/file");
        const tracker = makeEtaTracker();
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          patch(file.name, {
            progress: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
            etaSeconds: tracker(e.loaded, e.total),
          });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload failed")));
        xhr.onerror = () => reject(new Error("upload failed"));
        xhr.send(fd);
      });
    },
    [projectId, patch],
  );

  /**
   * Upload a set of files. When `assetId` is set, each file becomes the next
   * version of that asset (used by drag-to-version).
   */
  const upload = React.useCallback(
    async (files: FileList | File[], opts: { folderId?: string | null; assetId?: string } = {}) => {
      const list = Array.from(files);
      for (const file of list) {
        const kind = classifyFile(file);
        if (!kind) {
          toast.error(`Unsupported file: ${file.name}`);
          continue;
        }
        setItems((prev) => [...prev, { name: file.name, progress: 0, status: "uploading" }]);
        try {
          if (kind === "video") await uploadVideo(file, opts);
          else await uploadFile(file, kind, opts);
          patch(file.name, { status: "done", progress: 100 });
        } catch {
          patch(file.name, { status: "error" });
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      router.refresh();
      setTimeout(
        () => setItems((prev) => prev.filter((i) => i.status === "uploading" || i.status === "processing")),
        2500,
      );
    },
    [uploadVideo, uploadFile, patch, router],
  );

  return { upload, items, busy };
}
