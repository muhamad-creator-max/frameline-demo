"use client";

import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Frameline mark — green tile with film icon + product wordmark.
 * Ported from the design package.
 */
export function FrameMark({
  size = 26,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
      style={{ fontSize: 16, letterSpacing: "-0.03em" }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: 7,
          background: "var(--accent)",
          color: "var(--accent-contrast)",
          boxShadow: "var(--glow)",
        }}
      >
        <Film size={size * 0.6} strokeWidth={2} />
      </span>
      {showWordmark && <span>Frameline</span>}
    </div>
  );
}
