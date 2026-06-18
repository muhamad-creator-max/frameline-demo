"use client";

import * as React from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Settings,
  Search,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTimecodeFrames, DEFAULT_FPS } from "@/lib/review/coords";
import type { PlayerState, ReviewPlayerHandle } from "./review-player";
import { SeekBar, type SeekMarker } from "./seek-bar";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

/** Zoom presets (Fit = contain the whole frame; 1 = 100% native). */
export const ZOOM_LEVELS = [
  { label: "Fit", value: 0 },
  { label: "50%", value: 0.5 },
  { label: "100%", value: 1 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "175%", value: 1.75 },
  { label: "200%", value: 2 },
];

/**
 * Our control bar. Frame-accurate timecode, speed, volume/mute, quality
 * (Mux/HLS renditions), fullscreen, ±1 frame step, optional zoom, and the
 * merged comment markers overlaid on the seek bar.
 */
export function ReviewControls({
  player,
  state,
  fps = DEFAULT_FPS,
  markers,
  onMarkerClick,
  showVolume = true,
  showFullscreen = true,
  zoom,
  onZoomChange,
}: {
  player: ReviewPlayerHandle | null;
  state: PlayerState;
  fps?: number;
  /** Comment markers to overlay on the seek bar (already merged is fine). */
  markers?: SeekMarker[];
  onMarkerClick?: (m: SeekMarker) => void;
  showVolume?: boolean;
  showFullscreen?: boolean;
  /** Current zoom value (0 = Fit). When provided, a Zoom menu shows. */
  zoom?: number;
  onZoomChange?: (z: number) => void;
}) {
  const dur = state.duration || 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 12px 9px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-raw)",
        background: "var(--surface)",
      }}
    >
      {/* seek bar with merged comment markers */}
      <SeekBar
        currentTime={state.currentTime}
        duration={dur}
        markers={markers ?? []}
        onSeek={(t) => player?.seek(t)}
        onMarkerClick={onMarkerClick}
        fps={fps}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* frame step back */}
        <IconBtn title="Previous frame" onClick={() => player?.stepFrames(-1)}>
          <ChevronLeft size={16} />
        </IconBtn>

        {/* play / pause */}
        <button
          type="button"
          onClick={() => player?.togglePlay()}
          title={state.playing ? "Pause" : "Play"}
          style={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {state.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* frame step forward */}
        <IconBtn title="Next frame" onClick={() => player?.stepFrames(1)}>
          <ChevronRight size={16} />
        </IconBtn>

        {/* frame-accurate timecode HH:MM:SS:FR */}
        <span style={timeStyle}>{formatTimecodeFrames(state.currentTime, fps)}</span>
        <span style={{ color: "var(--text-3)" }}>/</span>
        <span style={{ ...timeStyle, color: "var(--text-3)" }}>{formatTimecodeFrames(dur, fps)}</span>

        <div style={{ flex: 1 }} />

        {/* volume / mute */}
        {showVolume && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn
              title={state.muted || state.volume === 0 ? "Unmute" : "Mute"}
              onClick={() => player?.setMuted(!(state.muted || state.volume === 0))}
            >
              {state.muted || state.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </IconBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.muted ? 0 : state.volume}
              onChange={(e) => player?.setVolume(parseFloat(e.target.value))}
              style={{ width: 64, accentColor: "var(--accent)", cursor: "pointer" }}
            />
          </div>
        )}

        {/* zoom (single view only) */}
        {zoom != null && onZoomChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" style={pillBtn} title="Zoom">
                <Search size={14} /> {zoomLabel(zoom)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[12px]">Zoom</DropdownMenuLabel>
              {ZOOM_LEVELS.map((z) => (
                <DropdownMenuItem
                  key={z.label}
                  onClick={() => onZoomChange(z.value)}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span style={{ flex: 1 }}>{z.label}</span>
                  {zoom === z.value && <Check size={14} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* speed */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" style={pillBtn} title="Playback speed">
              <Gauge size={14} /> {state.playbackRate}×
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[12px]">Speed</DropdownMenuLabel>
            {SPEEDS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => player?.setRate(s)}
                className="flex items-center gap-2 text-[13px]"
              >
                <span style={{ flex: 1 }}>{s}×</span>
                {state.playbackRate === s && <Check size={14} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* quality */}
        {state.qualities.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" style={pillBtn} title="Quality">
                <Settings size={14} /> {qualityLabel(state)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[12px]">Quality</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => player?.setQuality(-1)}
                className="flex items-center gap-2 text-[13px]"
              >
                <span style={{ flex: 1 }}>Auto</span>
                {state.autoQuality && <Check size={14} />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {state.qualities.map((q) => (
                <DropdownMenuItem
                  key={q.index}
                  onClick={() => player?.setQuality(q.index)}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span style={{ flex: 1 }}>{q.label}</span>
                  {q.selected && <Check size={14} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* fullscreen */}
        {showFullscreen && (
          <IconBtn title="Fullscreen" onClick={() => player?.toggleFullscreen()}>
            <Maximize size={16} />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function zoomLabel(z: number) {
  return z === 0 ? "Fit" : `${Math.round(z * 100)}%`;
}

function qualityLabel(state: PlayerState) {
  if (state.autoQuality) {
    const sel = state.qualities.find((q) => q.selected);
    return sel ? `Auto (${sel.label})` : "Auto";
  }
  return state.qualities.find((q) => q.selected)?.label ?? "Auto";
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        display: "grid",
        placeItems: "center",
        borderRadius: 7,
        border: "none",
        background: "transparent",
        color: "var(--text-2)",
        cursor: "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

const timeStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-2)",
  fontFamily: "var(--font-jetbrains-mono, monospace)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const pillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 10px",
  borderRadius: 7,
  border: "1px solid var(--border-raw)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
  flexShrink: 0,
};
