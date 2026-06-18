"use client";

import * as React from "react";
import type { MediaPlayerElement } from "vidstack/elements";
// Base styles for the headless video provider (no default layout — we render
// our own controls). Keeps the <video> fitted/sized correctly.
import "vidstack/player/styles/base.css";

/**
 * Our player, built on the Vidstack web components (vidstack@1.x) — no React
 * adapter needed. We imperatively mount a headless `<media-player>` (no built-in
 * layout) into a container and expose a small typed handle + reactive state, so
 * the custom control bar (ReviewControls) drives it. Used by BOTH single view
 * and compare view.
 *
 * The element's public runtime API (currentTime, play/pause, muted, volume,
 * playbackRate, state, subscribe, enterFullscreen) is stable in vidstack 1.x.
 */

export interface QualityOption {
  /** Index into the player's quality list (-1 = Auto). */
  index: number;
  label: string;
  height: number | null;
  selected: boolean;
}

export interface PlayerState {
  playing: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  playbackRate: number;
  fullscreen: boolean;
  canPlay: boolean;
  seeking: boolean;
  /** Available Mux/HLS renditions (+ Auto), for the quality menu. */
  qualities: QualityOption[];
  /** True when quality is auto-selected by ABR. */
  autoQuality: boolean;
}

export interface ReviewPlayerHandle {
  el: MediaPlayerElement | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setRate: (r: number) => void;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
  toggleFullscreen: () => void;
  /** Step by N frames (assumes 30fps unless duration metadata says otherwise). */
  stepFrames: (frames: number) => void;
  /** Select a quality by index (-1 = Auto / let ABR decide). */
  setQuality: (index: number) => void;
  getCurrentTime: () => number;
  getState: () => PlayerState;
}

const FPS = 30;

const EMPTY_STATE: PlayerState = {
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

/** A vidstack VideoQuality entry (subset we use). */
interface VsQuality {
  height?: number;
  width?: number;
  bitrate?: number;
  selected?: boolean;
}

// Minimal structural type for the vidstack element runtime API we use, so we
// don't fight the library's deeply-bundled types at the call site.
type VidstackQualityList = {
  readonly length: number;
  readonly selectedIndex: number;
  autoSelect: () => void;
  switchGain?: number;
  [index: number]: VsQuality & { selected: boolean };
} & Iterable<VsQuality>;

type VidstackEl = MediaPlayerElement & {
  state: Record<string, unknown>;
  subscribe: (cb: (state: Record<string, unknown>) => void) => () => void;
  currentTime: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  qualities: VidstackQualityList;
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  enterFullscreen: () => Promise<void> | void;
  exitFullscreen: () => Promise<void> | void;
};

/** Build the quality menu options from the player's quality list. */
function readQualities(el: VidstackEl | null): { qualities: QualityOption[]; autoQuality: boolean } {
  const list = el?.qualities;
  if (!list || list.length === 0) return { qualities: [], autoQuality: true };
  const items: VsQuality[] = Array.from(list as Iterable<VsQuality>);
  const selectedIndex = list.selectedIndex;
  // `autoSelect`/auto is reflected by state; infer from element when available.
  const autoQuality = !!(el?.state?.autoQuality ?? (el?.state as Record<string, unknown>)?.canSetQuality === false);
  const opts: QualityOption[] = items.map((q, i) => ({
    index: i,
    label: q.height ? `${q.height}p` : `Q${i + 1}`,
    height: q.height ?? null,
    selected: !autoQuality && i === selectedIndex,
  }));
  // Sort highest-first for a familiar menu order.
  opts.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return { qualities: opts, autoQuality };
}

function readState(stateObj: Record<string, unknown>, el: VidstackEl | null): PlayerState {
  const s = stateObj ?? {};
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
  const bool = (k: string) => !!s[k];
  const { qualities, autoQuality } = readQualities(el);
  return {
    playing: bool("playing"),
    paused: bool("paused"),
    currentTime: num("currentTime"),
    duration: Number.isFinite(num("duration")) ? num("duration") : 0,
    muted: bool("muted"),
    volume: typeof s.volume === "number" ? (s.volume as number) : 1,
    playbackRate: typeof s.playbackRate === "number" ? (s.playbackRate as number) : 1,
    fullscreen: bool("fullscreen"),
    canPlay: bool("canPlay"),
    seeking: bool("seeking"),
    qualities,
    autoQuality,
  };
}

export const ReviewPlayer = React.forwardRef<
  ReviewPlayerHandle,
  {
    src: string;
    poster?: string;
    /** Mute the element (used by the compare mirror to avoid duplicate audio). */
    muted?: boolean;
    /** Fired on every state change (drives the control bar + store sync). */
    onState?: (s: PlayerState) => void;
    /** Object-fit for the video (default "contain" — fit-size). */
    fit?: "contain" | "cover";
    className?: string;
    style?: React.CSSProperties;
  }
>(function ReviewPlayer({ src, poster, muted, onState, fit = "contain", className, style }, ref) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const elRef = React.useRef<VidstackEl | null>(null);
  const onStateRef = React.useRef(onState);
  onStateRef.current = onState;

  const handle = React.useMemo<ReviewPlayerHandle>(
    () => ({
      get el() {
        return elRef.current;
      },
      play: () => void elRef.current?.play(),
      pause: () => void elRef.current?.pause(),
      togglePlay: () => {
        const el = elRef.current;
        if (!el) return;
        if (el.paused) void el.play();
        else el.pause();
      },
      seek: (t) => {
        if (elRef.current) elRef.current.currentTime = Math.max(0, t);
      },
      setRate: (r) => {
        if (elRef.current) elRef.current.playbackRate = r;
      },
      setMuted: (m) => {
        if (elRef.current) elRef.current.muted = m;
      },
      setVolume: (v) => {
        if (elRef.current) {
          elRef.current.volume = Math.min(1, Math.max(0, v));
          if (v > 0) elRef.current.muted = false;
        }
      },
      toggleFullscreen: () => {
        const el = elRef.current;
        if (!el) return;
        const fs = !!(el.state as Record<string, unknown>)?.fullscreen;
        if (fs) void el.exitFullscreen?.();
        else void el.enterFullscreen?.();
      },
      stepFrames: (frames) => {
        const el = elRef.current;
        if (!el) return;
        el.pause();
        el.currentTime = Math.max(0, el.currentTime + frames / FPS);
      },
      setQuality: (index) => {
        const el = elRef.current;
        const list = el?.qualities;
        if (!list) return;
        if (index < 0) {
          list.autoSelect();
        } else {
          const q = list[index];
          if (q) q.selected = true;
        }
      },
      getCurrentTime: () => elRef.current?.currentTime ?? 0,
      getState: () =>
        elRef.current ? readState(elRef.current.state, elRef.current) : EMPTY_STATE,
    }),
    [],
  );

  React.useImperativeHandle(ref, () => handle, [handle]);

  // Mount the vidstack player once; update src/poster reactively below.
  React.useEffect(() => {
    let disposed = false;
    let unsub: (() => void) | undefined;
    let el: VidstackEl | undefined;

    (async () => {
      const host = hostRef.current;
      if (!host) return;
      // Lazy import so the web components register only on the client.
      const { VidstackPlayer } = await import("vidstack/global/player");
      if (disposed || !hostRef.current) return;

      el = (await VidstackPlayer.create({
        target: host,
        // headless: no built-in `layout` — we render our own controls.
        src,
        poster,
        muted: !!muted,
        playsInline: true,
      } as never)) as unknown as VidstackEl;

      if (disposed) {
        (el as unknown as { destroy?: () => void }).destroy?.();
        return;
      }
      elRef.current = el;

      // Subscribe to reactive state → React (pass the state object directly).
      unsub = el.subscribe((s) => {
        onStateRef.current?.(readState(s, el ?? null));
      });
      // Emit an initial snapshot.
      onStateRef.current?.(readState(el.state, el));
    })();

    return () => {
      disposed = true;
      unsub?.();
      const node = elRef.current as unknown as { destroy?: () => void } | null;
      node?.destroy?.();
      elRef.current = null;
    };
    // Mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to src / poster / muted changes without remounting.
  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    (el as unknown as { src: string }).src = src;
  }, [src]);
  React.useEffect(() => {
    const el = elRef.current as unknown as { poster?: string } | null;
    if (el && poster != null) el.poster = poster;
  }, [poster]);
  React.useEffect(() => {
    if (elRef.current) elRef.current.muted = !!muted;
  }, [muted]);

  // Inject the sizing CSS once (the host div is owned by vidstack after mount,
  // so we can't render children into it).
  React.useEffect(() => {
    const ID = "review-player-style";
    if (document.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = `
      [data-review-player] { position: relative; }
      [data-review-player] media-player,
      [data-review-player] media-provider,
      [data-review-player] video {
        width: 100%; height: 100%; display: block;
      }
      [data-review-player] media-provider,
      [data-review-player] video {
        object-fit: var(--media-object-fit, contain);
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      data-review-player=""
      style={{
        width: "100%",
        height: "100%",
        ["--media-object-fit" as string]: fit,
        background: "#000",
        ...style,
      }}
    />
  );
});
