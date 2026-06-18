import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession, resolveSharedProject } from "@/lib/review/guest";

export const runtime = "nodejs";

/**
 * Load a comment and confirm it belongs to this project AND to the calling
 * guest (token match). Returns the comment row or null.
 */
async function ownComment(slug: string, commentId: string) {
  const project = await resolveSharedProject(slug);
  if (!project) return { error: "not found" as const, status: 404 };
  const session = await readGuestSession(slug);
  if (!session) return { error: "identify first" as const, status: 401 };

  const admin = createAdminClient();
  const { data: raw } = await admin
    .from("review_comments")
    .select("id, author_guest_token, asset:review_assets!inner(project_id)")
    .eq("id", commentId)
    .maybeSingle();
  const data = raw as { id: string; author_guest_token: string | null; asset: { project_id: string } | null } | null;
  if (!data || data.asset?.project_id !== project.id) return { error: "not found" as const, status: 404 };
  if (data.author_guest_token !== session.token) return { error: "forbidden" as const, status: 403 };
  return { admin };
}

/** PATCH /api/review/r/[slug]/comments/[id] — edit own comment body. */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const guard = await ownComment(slug, id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { body } = (await req.json()) as { body?: string };
  if (typeof body !== "string") return NextResponse.json({ error: "body required" }, { status: 400 });

  const { error } = await guard.admin.from("review_comments").update({ body }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/review/r/[slug]/comments/[id] — delete own comment. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const guard = await ownComment(slug, id);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { error } = await guard.admin.from("review_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
