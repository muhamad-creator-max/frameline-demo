import { NextResponse } from "next/server";
import { newId } from "@/lib/utils";
import { encodeGuestCookie, guestCookieName, readGuestSession, resolveSharedProject } from "@/lib/review/guest";

export const runtime = "nodejs";

/**
 * POST /api/review/r/[slug]/identify  Body: { name }
 * Asks for the guest's name once after the link opens. Mints a session token
 * and sets an httpOnly cookie so the guest's comments group together and they
 * can edit/delete their own within the session.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Reuse an existing token if the guest already has one (keeps authorship stable).
  const existing = await readGuestSession(slug);
  const token = existing?.token ?? newId();
  const clean = name.trim().slice(0, 80);

  const res = NextResponse.json({ token, name: clean });
  res.cookies.set(guestCookieName(slug), encodeGuestCookie(token, clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
