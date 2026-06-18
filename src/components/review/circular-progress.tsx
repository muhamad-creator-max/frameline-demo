"use client";

import * as React from "react";

/**
 * Small circular progress ring. Pass a 0–100 `value` for determinate progress,
 * or omit it for an indeterminate (spinning) ring used while Mux processes.
 */
export function CircularProgress({
  value,
  size = 46,
  stroke = 4,
}: {
  value?: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const indeterminate = value == null;
  const pct = Math.min(100, Math.max(0, value ?? 25));
  const dash = (pct / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={indeterminate ? { animation: "rv-spin 0.9s linear infinite" } : undefined}
    >
      <style>{`@keyframes rv-spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,.25)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: indeterminate ? undefined : "stroke-dasharray .2s ease" }}
      />
      {!indeterminate && (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={size * 0.26}
          fontWeight={600}
          fill="#fff"
        >
          {Math.round(pct)}
        </text>
      )}
    </svg>
  );
}
