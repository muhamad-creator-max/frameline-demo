"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Pencil, Pause, Play, Music } from "lucide-react";
import { useReviewStore } from "@/lib/review/store";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { statusOption } from "@/lib/review/status";
import { formatTimecodeFrames, DEFAULT_FPS } from "@/lib/review/coords";
import type { AnnotationCoordinates } from "@/lib/supabase/database.types";
import type { AnnotationDTO, CommentDTO, VersionDTO } from "@/lib/review/types";
import type { Box } from "@/lib/review/coords";
import type { AnnotationLayerHandle, AnnotationLayerState } from "./annotation-layer";
import { AnnotationToolbar } from "./annotation-toolbar";
import { ReviewPlayer, type ReviewPlayerHandle, type PlayerState } from "./player/review-player";
import { ReviewControls } from "./player/review-controls";
import type { SeekMarker } from "./player/seek-bar";

// Konva must not run on the server.
const AnnotationLayer = dynamic(
  () => import("./annotation-layer").then((m) => m.AnnotationLayer),
  { ssr: false },
);

export interface VideoStageHandle {
  seekTo: (t: number) => void;
  pause: () => void;
  getCurrentTime: () => number;
}

const EMPTY_PLAYER_STATE: PlayerState = {
  playing: false,
  paused: true,
  currentTime: 0,
  duration: 0,
  muted: false,
  volume: 1,
  playbackRate: 1,
  fullscreen: false,
  canPlay: false,
  seeking: false,
  qualities: [],
  autoQuality: true,
};

/**
 * The left pane: media + the Konva annotation overlay. Uses OUR player
 * (ReviewPlayer, vidstack-based) for video, with a custom ReviewControls bar.
 * The same player powers compare mode: the primary player here plus a slaved,
 * muted mirror of the compare version, driven by a single full-width control bar.
 */
export const VideoStage = React.forwardRef<
  VideoStageHandle,
  {
    kind: "video" | "image" | "audio";
    version: VersionDTO;
    src: string | null;
    annotations: AnnotationDTO[];
    onSubmitAnnotation: (draft: {
      type: AnnotationDTO["type"];
      coordinates: AnnotationCoordinates;
      color: string;
      strokeWidth: number;
      timestampSeconds: number;
    }) => void;
    onEditAnnotation?: (id: string, coordinates: AnnotationCoordinates) => void;
    /** Compare mode (video only): slaved mirror of this version on the right. */
    compareVersion?: VersionDTO | null;
    compareSrc?: string | null;
    compareAnnotations?: AnnotationDTO[];
    compareHeader?: React.ReactNode;
  }
>(function VideoStage(
  {
    kind,
    version,
    src,
    annotations,
    onSubmitAnnotation,
    onEditAnnotation,
    compareVersion,
    compareSrc,
    compareAnnotations,
    compareHeader,
  },
  ref,
) {
  const playerRef = React.useRef<ReviewPlayerHandle | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const [box, setBox] = React.useState<Box>({ width: 0, height: 0 });
  const [pstate, setPstate] = React.useState<PlayerState>(EMPTY_PLAYER_STATE);
  const layerRef = React.useRef<AnnotationLayerHandle | null>(null);
  const [layerState, setLayerState] = React.useState({ canUndo: false, canRedo: false, hasSelection: false });

  const annotating = useReviewStore((s) => s.annotating);
  const setAnnotating = useReviewStore((s) => s.setAnnotating);
  const setCurrentTime = useReviewStore((s) => s.setCurrentTime);
  const setDuration = useReviewStore((s) => s.setDuration);
  const setPlaying = useReviewStore((s) => s.setPlaying);
  const activeCommentId = useReviewStore((s) => s.activeCommentId);
  const setActiveCommentId = useReviewStore((s) => s.setActiveCommentId);
  const comments = useReviewStore((s) => s.comments);
  const drafts = useReviewStore((s) => s.drafts);
  const setDrafts = useReviewStore((s) => s.setDrafts);

  const comparing = kind === "video" && !!compareVersion && !!compareSrc;

  // Zoom (single view only). 0 = Fit (contain); >0 = scale factor.
  const [zoom, setZoom] = React.useState(0);
  // Zoom anchor as a percentage of the media box (where the wheel pointer is).
  const [zoomOrigin, setZoomOrigin] = React.useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Comment markers for the seek bar (top-level timestamped comments).
  const seekMarkers = React.useMemo<SeekMarker[]>(() => {
    const out: SeekMarker[] = [];
    for (const c of comments as CommentDTO[]) {
      if (c.timestampSeconds == null) continue;
      out.push({
        id: c.id,
        t: c.timestampSeconds,
        color: statusOption(c.status).dot,
        label: `${formatTimecodeFrames(c.timestampSeconds, DEFAULT_FPS)} · ${c.authorName}`,
      });
    }
    return out;
  }, [comments]);

  // ── measure the media box (for the annotation overlay) ──
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [kind, src]);

  // ── player state → review store (single source of truth) ──
  const handlePlayerState = React.useCallback(
    (s: PlayerState) => {
      setPstate(s);
      setCurrentTime(s.currentTime);
      setDuration(s.duration);
      setPlaying(s.playing);
    },
    [setCurrentTime, setDuration, setPlaying],
  );

  // ── current time helpers ──
  const getTime = React.useCallback(() => {
    if (kind === "video") return playerRef.current?.getCurrentTime() ?? 0;
    const raw = kind === "audio" ? audioRef.current?.currentTime : 0;
    return Number.isFinite(raw) ? (raw as number) : 0;
  }, [kind]);

  const pauseMedia = React.useCallback(() => {
    if (kind === "video") playerRef.current?.pause();
    if (kind === "audio") audioRef.current?.pause();
  }, [kind]);

  const seekTo = React.useCallback(
    (t: number) => {
      if (kind === "video") playerRef.current?.seek(t);
      if (kind === "audio" && audioRef.current) audioRef.current.currentTime = t;
      setCurrentTime(t);
    },
    [kind, setCurrentTime],
  );

  const handleDraftChange = React.useCallback(
    (ds: { type: AnnotationDTO["type"]; coordinates: AnnotationCoordinates; color: string; strokeWidth: number }[]) => {
      // All shapes are drawn on the same paused frame → share that timestamp.
      const t = getTime();
      setDrafts(ds.map((d) => ({ ...d, timestampSeconds: t })));
    },
    [setDrafts, getTime],
  );

  React.useImperativeHandle(
    ref,
    () => ({ seekTo, pause: pauseMedia, getCurrentTime: getTime }),
    [seekTo, getTime, pauseMedia],
  );

  // Saved annotations are time-linked to a single frame: they show ONLY while
  // paused on (≈) their timestamp. Hitting play hides them instantly (the
  // `playing` flag flips before the first timeupdate, so there's no lingering
  // frame); seeking away while paused also hides them. Tolerance covers a couple
  // of frames so a ±1-frame step doesn't drop the drawing.
  const TIME_TOLERANCE = 0.12;
  const highlightIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (!activeCommentId || pstate.playing) return ids;
    for (const a of annotations) {
      if (a.commentId !== activeCommentId) continue;
      const onFrame = Math.abs((a.timestampSeconds ?? 0) - pstate.currentTime) <= TIME_TOLERANCE;
      if (onFrame) ids.add(a.id);
    }
    return ids;
  }, [activeCommentId, annotations, pstate.currentTime, pstate.playing]);

  // Annotate mode is toggled from the comment composer (setAnnotating). When it
  // turns on, pause the media so the user draws on a still frame.
  React.useEffect(() => {
    if (annotating) pauseMedia();
  }, [annotating, pauseMedia]);

  function finishAnnotate() {
    setAnnotating(false);
    setDrafts([]);
    layerRef.current?.clear();
  }

  void onSubmitAnnotation;

  // Scroll-wheel zoom (single view, video only, NOT while annotating — zooming
  // would misalign the drawing canvas). Anchors at the pointer.
  const zoomable = kind === "video" && !comparing && !annotating;
  function onWheelZoom(e: React.WheelEvent) {
    if (!zoomable) return;
    e.preventDefault();
    // Anchor the zoom at the pointer's position within the media box.
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width && rect.height) {
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setZoomOrigin({ x, y });
    }
    setZoom((z) => {
      const base = z === 0 ? 1 : z; // treat Fit as 100% baseline when zooming in
      const next = base + (e.deltaY < 0 ? 0.25 : -0.25);
      const clamped = Math.min(2, Math.max(0.5, next));
      if (clamped <= 1 && e.deltaY > 0 && z === 0) {
        // returned to Fit — recenter the anchor
        setZoomOrigin({ x: 50, y: 50 });
        return 0;
      }
      return clamped;
    });
  }
  const scale = zoom === 0 ? 1 : zoom;

  const mediaInner = (
    <div
      ref={boxRef}
      onWheel={zoomable ? onWheelZoom : undefined}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      {/* Zoom wrapper holds BOTH the video AND the annotation overlay so saved
          annotations scale/anchor WITH the frame instead of drifting on zoom. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          transition: "transform .12s ease",
        }}
      >
        {kind === "video" && src && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: annotating ? "none" : undefined }}>
            <ReviewPlayer ref={playerRef} src={src} poster={version.thumbnailUrl ?? undefined} onState={handlePlayerState} />
          </div>
        )}

        {kind === "image" && src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={version.fileUrl ?? "image"}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        )}

        {/* annotation overlay — audio has no spatial frame, so skip it there.
            Inside the zoom wrapper so it tracks the video on zoom. */}
        {kind !== "audio" && box.width > 0 && (
          <AnnotationLayer
            ref={layerRef}
            box={box}
            readAnnotations={annotations}
            highlightIds={highlightIds}
            interactive={annotating}
            onDraftChange={handleDraftChange}
            onEditAnnotation={onEditAnnotation}
            onStateChange={setLayerState as (s: AnnotationLayerState) => void}
          />
        )}
      </div>

      {kind === "audio" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            color: "var(--text-2)",
          }}
        >
          <Music size={56} style={{ color: "var(--text-3)" }} />
          {src && (
            <audio
              ref={audioRef}
              src={src}
              controls
              style={{ width: "min(560px, 90%)" }}
              onTimeUpdate={() => setCurrentTime(getTime())}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )}
        </div>
      )}

      {/* Click-to-toggle + center overlay play button (video, not annotating). */}
      {kind === "video" && src && !annotating && (
        <button
          type="button"
          aria-label={pstate.playing ? "Pause" : "Play"}
          onClick={() => playerRef.current?.togglePlay()}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {!pstate.playing && (
            <span
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(0,0,0,.55)",
                backdropFilter: "blur(2px)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                boxShadow: "0 6px 24px rgba(0,0,0,.4)",
                transition: "transform .12s ease",
              }}
            >
              <Play size={30} style={{ marginInlineStart: 3 }} fill="#fff" />
            </span>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, flex: 1 }}>
      {comparing && compareHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 0" }}>{compareHeader}</div>
      )}

      <div
        style={{
          position: "relative",
          background: "#000",
          borderRadius: "var(--r-md)",
          overflow: "hidden",
          aspectRatio: comparing
            ? undefined
            : kind === "audio"
              ? "16 / 6"
              : (version.aspectRatio?.replace(":", " / ") ?? "16 / 9"),
          maxHeight: "72vh",
          display: comparing ? "flex" : undefined,
          flexDirection: comparing && isMobile ? "column" : undefined,
          height: comparing ? (isMobile ? "64vh" : "56vh") : undefined,
          gap: comparing ? 2 : undefined,
        }}
      >
        {comparing ? (
          <>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>{mediaInner}</div>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
              <CompareMirror
                version={compareVersion!}
                src={compareSrc!}
                annotations={compareAnnotations ?? []}
                activeCommentId={activeCommentId}
              />
            </div>
          </>
        ) : (
          mediaInner
        )}

        {/* Paused-to-annotate hint */}
        {annotating && (
          <div
            style={{
              position: "absolute",
              insetBlockEnd: 12,
              insetInlineStart: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 7,
              background: "rgba(0,0,0,.6)",
              color: "#fff",
              fontSize: 12,
            }}
          >
            <Pause size={13} /> Paused · draw on the frame, then add your comment
          </div>
        )}
      </div>

      {/* Our control bar — single view AND the full-width compare transport.
          Comment markers are merged + overlaid on the seek bar. Audio uses its
          native <audio controls>; images have none. */}
      {kind === "video" && !annotating && (
        <ReviewControls
          player={playerRef.current}
          state={pstate}
          markers={seekMarkers}
          onMarkerClick={(m) => {
            // Pause on the comment's frame so its annotation shows on that frame.
            pauseMedia();
            setActiveCommentId(m.id);
          }}
          zoom={zoomable ? zoom : undefined}
          onZoomChange={
            zoomable
              ? (z) => {
                  // menu has no pointer → anchor from the center
                  setZoomOrigin({ x: 50, y: 50 });
                  setZoom(z);
                }
              : undefined
          }
        />
      )}

      {/* Annotate mode: a stripped timeline showing ONLY a green draggable
          comment dot (no scrub slider). Dragging it scrubs the preview frame so
          the user lands on the exact frame to comment on. */}
      {kind === "video" && annotating && (
        <AnnotateTimeline
          currentTime={pstate.currentTime}
          duration={pstate.duration}
          onScrub={(t) => seekTo(t)}
        />
      )}

      {/* Annotation tools — at the BOTTOM, below the player controls. */}
      {kind !== "audio" && annotating && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AnnotationToolbar
            canUndo={layerState.canUndo}
            canRedo={layerState.canRedo}
            hasSelection={layerState.hasSelection}
            onUndo={() => layerRef.current?.undo()}
            onRedo={() => layerRef.current?.redo()}
            onDelete={() => layerRef.current?.deleteSelected()}
            onClose={finishAnnotate}
          />
        </div>
      )}

      {/* When a draft exists, hint the user to finish in the composer (panel). */}
      {annotating && drafts.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--accent-weak)",
            border: "1px solid var(--border-raw)",
            fontSize: 13,
            color: "var(--text)",
          }}
        >
          <Pencil size={14} style={{ color: "var(--accent-ink)" }} />
          <span>Annotation ready — write your comment on the right, then post to attach it.</span>
        </div>
      )}
    </div>
  );
});

/**
 * Annotate-mode timeline: no scrub slider — just a single green "comment" dot
 * the user drags along the track to choose the frame their annotation pins to.
 * Dragging scrubs the live preview (onScrub) so they can land on the exact frame.
 */
function AnnotateTimeline({
  currentTime,
  duration,
  onScrub,
}: {
  currentTime: number;
  duration: number;
  onScrub: (t: number) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const pct = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const timeFromClientX = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  // While dragging, listen on the window so the pointer can leave the dot.
  React.useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onScrub(timeFromClientX(e.clientX));
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, onScrub, timeFromClientX]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-raw)",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--accent-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>
        Comment frame
      </span>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          // Click anywhere on the track to move the dot there + start dragging.
          onScrub(timeFromClientX(e.clientX));
          setDragging(true);
        }}
        style={{
          position: "relative",
          flex: 1,
          height: 18,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        {/* plain track line — NO progress fill (this isn't a scrubber) */}
        <div style={{ position: "absolute", insetInline: 0, height: 4, borderRadius: 2, background: "var(--surface-2)" }} />
        {/* the green draggable comment dot */}
        <div
          role="slider"
          aria-label="Comment timestamp"
          aria-valuenow={Math.round(currentTime)}
          style={{
            position: "absolute",
            insetInlineStart: `${pct}%`,
            transform: "translateX(-50%)",
            width: dragging ? 18 : 15,
            height: dragging ? 18 : 15,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--surface)",
            boxShadow: "var(--shadow-md)",
            transition: "width .1s ease, height .1s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-jetbrains-mono, monospace)", whiteSpace: "nowrap" }}>
        {formatTimecodeFrames(currentTime, DEFAULT_FPS)}
      </span>
    </div>
  );
}

/**
 * The compare "mirror": OUR player again, configured as a passive slave —
 * muted, follows the review store's currentTime / isPlaying so it stays in
 * lockstep with the primary. Shows a read-only annotation overlay for the
 * clicked comment when that comment belongs to THIS version.
 */
function CompareMirror({
  version,
  src,
  annotations,
  activeCommentId,
}: {
  version: VersionDTO;
  src: string;
  annotations: AnnotationDTO[];
  activeCommentId: string | null;
}) {
  const playerRef = React.useRef<ReviewPlayerHandle | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<Box>({ width: 0, height: 0 });

  const currentTime = useReviewStore((s) => s.currentTime);
  const isPlaying = useReviewStore((s) => s.isPlaying);
  const duration = version.durationS ?? 0;

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [src]);

  // Follow the primary's clock (correct drift > 0.2s), freeze at our own end.
  React.useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const target = duration ? Math.min(currentTime, duration) : currentTime;
    if (Math.abs(p.getCurrentTime() - target) > 0.2) p.seek(target);
  }, [currentTime, duration]);

  // Follow play/pause.
  React.useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const atEnd = duration && currentTime >= duration - 0.05;
    if (isPlaying && !atEnd) p.play();
    else p.pause();
  }, [isPlaying, currentTime, duration]);

  const highlightIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (activeCommentId) for (const a of annotations) if (a.commentId === activeCommentId) ids.add(a.id);
    return ids;
  }, [activeCommentId, annotations]);

  return (
    <div ref={boxRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          insetBlockStart: 8,
          insetInlineStart: 8,
          zIndex: 4,
          padding: "2px 8px",
          borderRadius: 5,
          background: "rgba(0,0,0,.65)",
          color: "#fff",
          fontSize: 11.5,
          fontWeight: 600,
        }}
      >
        V{version.version}
      </div>
      <ReviewPlayer ref={playerRef} src={src} poster={version.thumbnailUrl ?? undefined} muted />
      {box.width > 0 && highlightIds.size > 0 && (
        <AnnotationLayer
          box={box}
          readAnnotations={annotations}
          highlightIds={highlightIds}
          interactive={false}
          onDraftChange={() => {}}
        />
      )}
    </div>
  );
}
