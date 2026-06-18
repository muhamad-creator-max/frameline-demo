"use client";

import type { VersionDTO } from "@/lib/review/types";

/**
 * Client-safe playable URL resolver. Mux versions carry their HLS URL; storage/
 * bunny versions already have a (signed) fileUrl resolved server-side. Mirrors
 * `versionSrc` in server.ts but importable from client components.
 */
export function versionSrcClient(v: VersionDTO): string | null {
  if (v.provider === "mux" && v.muxPlaybackId) {
    return `https://stream.mux.com/${v.muxPlaybackId}.m3u8`;
  }
  return v.fileUrl;
}
