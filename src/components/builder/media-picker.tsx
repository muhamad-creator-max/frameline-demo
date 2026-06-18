"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, Upload, Type as TypeIcon, Play } from "lucide-react";
import { toast } from "sonner";
import type { MediaKind } from "@/lib/guideline/store";
import { Button } from "@/components/ui/button";

/**
 * Drop-zone style media picker for an option.
 * - image → Bunny upload (still image)
 * - gif ("Animated reference") → short looping clip (≤15 MB, ≤7 s) uploaded to
 *   Bunny and rendered as a controls-free muted autoplay loop, like an animated
 *   image. (Legacy rows may still hold real GIFs / transcoded WebMs.)
 * - video → Mux direct upload (returns upload id, polled until playback id ready)
 * - text  → no media; client builder uses the option label
 */

// "Animated reference" limits.
const ANIMATED_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ANIMATED_MAX_DURATION_S = 7;

/** Probe a local video file's duration (seconds) via a throwaway <video>. */
function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that video file"));
    };
    v.src = url;
  });
}
export function MediaPicker({
  mediaKind,
  mediaUrl,
  mediaProvider,
  mediaMeta,
  guidelineId,
  onChange,
}: {
  mediaKind: MediaKind;
  mediaUrl: string | null;
  mediaProvider: "bunny" | "mux" | "external" | null;
  mediaMeta?: Record<string, unknown>;
  guidelineId: string;
  onChange: (patch: {
    media_kind?: MediaKind;
    media_url?: string | null;
    media_provider?: "bunny" | "mux" | "external" | null;
    media_meta?: Record<string, unknown>;
  }) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  // Local blob preview while Mux transcodes in the background. Survives until
  // the playback-id arrives, then we revoke and the real Mux player takes over.
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  React.useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  // Detect a still-processing Mux upload — the ID we're holding is an upload
  // ID, not a playback ID. Two signals: explicit pending status, or the
  // string length (upload IDs are 50+ chars; playback IDs are ~27).
  const isPendingMux =
    mediaProvider === "mux" &&
    !!mediaUrl &&
    ((mediaMeta?.status as string | undefined) === "pending" || mediaUrl.length > 40);

  // Poll Mux while pending — works without webhooks (handy on localhost).
  React.useEffect(() => {
    if (!isPendingMux || !mediaUrl) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/uploads/mux/status?uploadId=${encodeURIComponent(mediaUrl)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "ready" && json.playbackId) {
          onChange({
            media_url: json.playbackId,
            media_provider: "mux",
            media_meta: {
              ...(mediaMeta ?? {}),
              status: "ready",
              duration_s: json.duration ?? null,
              aspect_ratio: json.aspectRatio ?? null,
              asset_id: json.assetId,
              upload_id: mediaUrl,
            },
          });
          // Drop the local blob — Mux player takes over now.
          setLocalPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          return; // stop polling
        }
        if (json.status === "errored") {
          toast.error("Mux processing failed for that video");
          onChange({ media_url: null, media_provider: null, media_meta: { status: "errored" } });
          return;
        }
      } catch {
        // network blip — keep polling
      }
      if (!cancelled) timeoutId = setTimeout(poll, 4000);
    };

    timeoutId = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPendingMux, mediaUrl]);

  async function uploadToBunny(file: File, meta: Record<string, unknown> = {}) {
    const form = new FormData();
    form.append("file", file);
    form.append("guidelineId", guidelineId);
    form.append("kind", mediaKind);
    const res = await fetch("/api/uploads/bunny", { method: "POST", body: form });
    // A large body that exceeds the server limit can come back with an empty
    // payload; guard so we surface a real message instead of a JSON parse error.
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `Upload failed (${res.status})`);
    onChange({
      media_url: (json as { url: string }).url,
      media_provider: "bunny",
      media_meta: { original_name: (json as { name?: string }).name, size: (json as { size?: number }).size, ...meta },
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      if (mediaKind === "gif") {
        // Animated reference: short looping clip → Bunny, no transcode.
        if (file.size > ANIMATED_MAX_BYTES) {
          throw new Error("That clip is over 15 MB — please trim or compress it.");
        }
        const duration = await probeDuration(file);
        if (Number.isFinite(duration) && duration > ANIMATED_MAX_DURATION_S + 0.25) {
          throw new Error(`That clip is ${Math.round(duration)}s — animated references must be ${ANIMATED_MAX_DURATION_S}s or shorter.`);
        }
        await uploadToBunny(file, { duration_s: Number.isFinite(duration) ? duration : null });
        return;
      }
      if (mediaKind === "video") {
        // 1. Show the raw file instantly via an object URL — no waiting on Mux.
        const blobUrl = URL.createObjectURL(file);
        setLocalPreview(blobUrl);

        // 2. Kick off Mux upload in parallel; the row gets media_url=uploadId
        //    so the poller can flip it to playback-id once Mux finishes.
        const initRes = await fetch("/api/uploads/mux", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ guidelineId }),
        });
        const init = await initRes.json();
        if (!initRes.ok) throw new Error(init.error ?? "Mux init failed");

        // Don't await this — let it run while the editor keeps working.
        fetch(init.uploadUrl, { method: "PUT", body: file }).catch((e) => {
          console.error("[mux] PUT failed", e);
          toast.error("Background upload to Mux failed — video will preview locally only.");
        });

        onChange({
          media_url: init.uploadId,
          media_provider: "mux",
          media_meta: { status: "pending", original_name: file.name },
        });
      } else {
        await uploadToBunny(file);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (mediaKind === "text") {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <div className="flex flex-col items-center gap-1 text-xs">
          <TypeIcon className="h-5 w-5" />
          <span>Text option</span>
        </div>
      </div>
    );
  }

  if (mediaUrl) {
    // Animated reference — a short clip rendered as a controls-free muted
    // autoplay loop. (Legacy rows holding a real GIF still animate as <img>.)
    if (mediaKind === "gif") {
      const isVideoFile = isAnimatedVideo(mediaUrl);
      return (
        <div className="relative h-full w-full bg-black">
          {isVideoFile ? (
            <video src={mediaUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
          <ReplaceButton onClick={() => fileRef.current?.click()} uploading={uploading} />
          <input
            ref={fileRef}
            type="file"
            accept={acceptFor(mediaKind)}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      );
    }
    if (mediaKind === "video" && mediaProvider === "mux") {
      if (isPendingMux) {
        // Instant preview from the local blob; Mux processes in background.
        if (localPreview) {
          return (
            <div className="relative h-full w-full bg-black">
              <video
                src={localPreview}
                className="h-full w-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
              <div className="absolute end-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white/80 backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" />
                Optimizing for streaming…
              </div>
              <ReplaceButton onClick={() => fileRef.current?.click()} uploading={uploading} />
              <input
                ref={fileRef}
                type="file"
                accept={acceptFor(mediaKind)}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          );
        }
        // Page reloaded mid-process — no blob, just show spinner.
        return (
          <div className="grid h-full place-items-center bg-black text-xs text-white/70">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing video…</span>
            </div>
          </div>
        );
      }
      // Ready: show Mux thumbnail with play badge
      return (
        <div className="relative h-full w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://image.mux.com/${mediaUrl}/thumbnail.jpg?width=800`}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black shadow-glow">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </div>
          <ReplaceButton onClick={() => fileRef.current?.click()} uploading={uploading} />
          <input
            ref={fileRef}
            type="file"
            accept={acceptFor(mediaKind)}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      );
    }
    return (
      <div className="relative h-full w-full">
        <Image
          src={mediaUrl}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
        />
        <ReplaceButton onClick={() => fileRef.current?.click()} uploading={uploading} />
        <input
          ref={fileRef}
          type="file"
          accept={acceptFor(mediaKind)}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      disabled={uploading}
      className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60"
    >
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Upload className="h-5 w-5" />
          <span>Upload {mediaKind === "gif" ? "animated reference" : mediaKind}</span>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={acceptFor(mediaKind)}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ReplaceButton({ onClick, uploading }: { onClick: () => void; uploading: boolean }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="absolute bottom-2 start-2"
      onClick={onClick}
      disabled={uploading}
    >
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      Replace
    </Button>
  );
}

function acceptFor(kind: MediaKind) {
  switch (kind) {
    case "image": return "image/png,image/jpeg,image/webp,image/avif";
    case "gif":   return "video/mp4,video/quicktime,video/webm";
    case "video": return "video/mp4,video/quicktime,video/webm";
    default:      return "";
  }
}

/** True when a "gif"-kind media_url points at a video clip (vs. a legacy GIF). */
export function isAnimatedVideo(url: string | null | undefined): boolean {
  return !!url && /\.(webm|mp4|mov|m4v)($|\?)/i.test(url);
}
