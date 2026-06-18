import "server-only";
import Mux from "@mux/mux-node";

let _mux: Mux | null = null;

export function getMux() {
  if (_mux) return _mux;
  _mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });
  return _mux;
}

/**
 * Create a direct upload URL — editor's browser PUTs the video file to this URL,
 * Mux ingests and emits a webhook with the playback id.
 */
export async function createDirectUpload(opts: {
  corsOrigin: string;
  passthrough?: string;
  /** Enable static MP4 renditions so the asset can be downloaded (review feature). */
  mp4Support?: boolean;
}) {
  const mux = getMux();
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      encoding_tier: "smart",
      max_resolution_tier: "1080p",
      passthrough: opts.passthrough,
      ...(opts.mp4Support ? { mp4_support: "capped-1080p" } : {}),
    } as Parameters<typeof mux.video.uploads.create>[0]["new_asset_settings"],
  });
  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

export function muxThumbnail(playbackId: string, opts: { time?: number; width?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.time != null) params.set("time", String(opts.time));
  if (opts.width) params.set("width", String(opts.width));
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?${params.toString()}`;
}

/** Adaptive (HLS) stream URL for a public playback id — fed to Vidstack. */
export function muxHlsUrl(playbackId: string) {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Look up an upload and return its asset's playback id, if ready.
 * Used by the /api/uploads/mux/status route so the client can poll without
 * needing the webhook to be reachable (handy on localhost).
 */
export async function getUploadPlayback(uploadId: string): Promise<{
  status: "waiting" | "asset_created" | "ready" | "errored";
  playbackId?: string;
  assetId?: string;
  duration?: number;
  aspectRatio?: string;
}> {
  const mux = getMux();
  const upload = await mux.video.uploads.retrieve(uploadId);
  if (!upload.asset_id) {
    return { status: upload.status === "errored" ? "errored" : "waiting" };
  }
  const asset = await mux.video.assets.retrieve(upload.asset_id);
  if (asset.status !== "ready") {
    return { status: "asset_created", assetId: asset.id };
  }
  return {
    status: "ready",
    assetId: asset.id,
    playbackId: asset.playback_ids?.[0]?.id,
    duration: asset.duration,
    aspectRatio: asset.aspect_ratio,
  };
}
