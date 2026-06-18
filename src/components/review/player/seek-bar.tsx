"use client";

import * as React from "react";
import { formatTimecodeFrames } from "@/lib/review/coords";

export interface SeekMarker {
  id: string;
  /** seconds */
  t: number;
  /** dot color (status-driven) */
  color: string;
  /** tooltip label */
  label: string;
}

interface Cluster {
  /** average time of the merged markers (for positioning + seek) */
  t: number;
  members: SeekMarker[];
  /** dominant color (first member's) */
  color: string;
}

/**
 * The player's seek/timeline bar with comment markers overlaid directly on it.
 * Markers that fall within ~1.5% of the bar width are MERGED into one cluster
 * dot. Dots sit small at 50% opacity and brighten on hover (matching the old
 * timeline strip styling); hovering shows a popover, clicking seeks.
 */
export function SeekBar({
  currentTime,
  duration,
  markers,
  onSeek,
  onMarkerClick,
  fps,
}: {
  currentTime: number;
  duration: number;
  markers: SeekMarker[];
  onSeek: (t: number) => void;
  onMarkerClick?: (m: SeekMarker) => void;
  fps: number;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

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

  // Drag-to-scrub: while the pointer is down, seek live on every move so the
  // viewport frame tracks the dragged playhead. Listen on the window so the
  // pointer can leave the (thin) track without dropping the drag.
  React.useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onSeek(timeFromClientX(e.clientX));
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, onSeek, timeFromClientX]);

  // Merge markers by pixel proximity (~1.5% of the bar width, min 10px).
  const clusters = React.useMemo<Cluster[]>(() => {
    if (!duration || markers.length === 0) return [];
    const thresholdPx = Math.max(10, width * 0.015);
    const sorted = [...markers].sort((a, b) => a.t - b.t);
    const out: Cluster[] = [];
    for (const m of sorted) {
      const last = out[out.length - 1];
      const xPx = (m.t / duration) * width;
      const lastXPx = last ? (last.t / duration) * width : -Infinity;
      if (last && Math.abs(xPx - lastXPx) <= thresholdPx) {
        last.members.push(m);
        // recompute average position
        last.t = last.members.reduce((s, x) => s + x.t, 0) / last.members.length;
      } else {
        out.push({ t: m.t, members: [m], color: m.color });
      }
    }
    return out;
  }, [markers, duration, width]);

  const pct = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
      {/* clickable + draggable track */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          // Seek immediately, then begin a live drag-scrub.
          onSeek(timeFromClientX(e.clientX));
          setDragging(true);
        }}
        style={{
          position: "relative",
          width: "100%",
          height: 6,
          borderRadius: 3,
          background: "var(--surface-2)",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* progress fill */}
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: "var(--accent)",
            borderRadius: 3,
          }}
        />
        {/* playhead */}
        <div
          style={{
            position: "absolute",
            insetInlineStart: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: dragging ? 16 : 12,
            height: dragging ? 16 : 12,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: dragging ? "var(--shadow-md)" : "var(--shadow-sm)",
            pointerEvents: "none",
            transition: "width .1s ease, height .1s ease",
          }}
        />

        {/* merged comment markers */}
        {clusters.map((c, i) => {
          const left = Math.min(100, Math.max(0, (c.t / duration) * 100));
          const isHover = hovered === i;
          const count = c.members.length;
          return (
            <button
              key={`${c.t}-${i}`}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              // Don't let clicking a marker start a track drag-scrub.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const first = c.members[0];
                onMarkerClick?.(first);
                onSeek(c.t);
              }}
              style={{
                position: "absolute",
                top: "50%",
                insetInlineStart: `${left}%`,
                transform: "translate(-50%, -50%)",
                width: isHover ? 12 : 9,
                height: isHover ? 12 : 9,
                borderRadius: "50%",
                background: c.color,
                border: "1.5px solid var(--surface)",
                opacity: isHover ? 1 : 0.5,
                cursor: "pointer",
                padding: 0,
                transition: "opacity .1s ease, width .1s ease, height .1s ease",
                boxShadow: isHover ? "var(--shadow-sm)" : "none",
                zIndex: isHover ? 3 : 2,
                display: "grid",
                placeItems: "center",
              }}
            >
              {count > 1 && (
                <span
                  style={{
                    fontSize: 7.5,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1,
                    pointerEvents: "none",
                  }}
                >
                  {count}
                </span>
              )}
              {isHover && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 7px)",
                    insetInlineStart: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    background: "var(--text)",
                    color: "var(--bg)",
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "4px 8px",
                    borderRadius: 6,
                    pointerEvents: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    maxWidth: 240,
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {count > 1 && (
                    <span style={{ fontWeight: 700 }}>
                      {count} comments · {formatTimecodeFrames(c.t, fps)}
                    </span>
                  )}
                  {c.members.slice(0, 4).map((mm) => (
                    <span key={mm.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: mm.color, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{mm.label}</span>
                    </span>
                  ))}
                  {count > 4 && <span style={{ color: "var(--text-3)" }}>+{count - 4} more</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
