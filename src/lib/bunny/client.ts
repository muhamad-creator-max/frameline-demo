import "server-only";

/**
 * Bunny Storage — used for raw, non-streaming files:
 *   - LUTs (.cube)
 *   - presets / project files (.json, .lrtemplate, .preset, etc.)
 *   - reference images, thumbnails
 *   - anything that does NOT need adaptive streaming (videos go to Mux)
 *
 * Uploads are proxied through our server route /api/uploads/bunny to keep
 * the storage password off the client.
 */

const HOST = process.env.BUNNY_STORAGE_HOSTNAME ?? "storage.bunnycdn.com";
const ZONE = process.env.BUNNY_STORAGE_ZONE!;
const PASS = process.env.BUNNY_STORAGE_PASSWORD!;
// Sanitize CDN hostname — strip protocol, trailing slash, and accidental suffixes.
const CDN = (process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ?? "")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "")
  .trim();

export async function bunnyPut(remotePath: string, body: Blob | ArrayBuffer | Buffer, contentType?: string) {
  if (!ZONE) throw new Error("BUNNY_STORAGE_ZONE is not set");
  if (!PASS) throw new Error("BUNNY_STORAGE_PASSWORD is not set");
  if (!CDN)  throw new Error("NEXT_PUBLIC_BUNNY_CDN_HOSTNAME is not set");

  const url = `https://${HOST}/${ZONE}/${stripLeadingSlash(remotePath)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: PASS,
      "Content-Type": contentType ?? "application/octet-stream",
    },
    // @ts-expect-error — Node fetch accepts Buffer / Uint8Array bodies
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed (${res.status}): ${detail || res.statusText}`);
  }
  const cdnUrl = bunnyCdnUrl(remotePath);
  console.log(`[bunny] uploaded → ${cdnUrl}`);
  return cdnUrl;
}

export async function bunnyDelete(remotePath: string) {
  const url = `https://${HOST}/${ZONE}/${stripLeadingSlash(remotePath)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: PASS },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Bunny delete failed: ${res.status}`);
  }
}

export function bunnyCdnUrl(remotePath: string) {
  return `https://${CDN}/${stripLeadingSlash(remotePath)}`;
}

function stripLeadingSlash(p: string) {
  return p.replace(/^\/+/, "");
}
