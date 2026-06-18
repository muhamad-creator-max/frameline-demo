import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** The per-project guest session cookie name. */
export function guestCookieName(slug: string) {
  return `rv_guest_${slug}`;
}

export interface GuestSession {
  token: string;
  name: string;
}

/**
 * Read the guest session for a project from cookies. The cookie stores
 * "<token>.<base64url(name)>" so we can show the name and authorize own-edits
 * without a DB round-trip.
 */
export async function readGuestSession(slug: string): Promise<GuestSession | null> {
  const jar = await cookies();
  const raw = jar.get(guestCookieName(slug))?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const token = raw.slice(0, dot);
  let name = "Guest";
  try {
    name = Buffer.from(raw.slice(dot + 1), "base64url").toString("utf8") || "Guest";
  } catch {
    /* keep default */
  }
  return token ? { token, name } : null;
}

export function encodeGuestCookie(token: string, name: string) {
  return `${token}.${Buffer.from(name, "utf8").toString("base64url")}`;
}

/**
 * Resolve a shareable project by slug for PUBLIC consumption. Returns null if
 * missing/trashed. Does NOT verify the password — callers gate on `hasPassword`.
 */
export async function resolveSharedProject(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("review_projects")
    .select("id, name, description, password_hash, allow_download, view_count, deleted_at")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  return data;
}
