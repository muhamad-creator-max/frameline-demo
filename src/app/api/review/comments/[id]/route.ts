import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CommentStatus, Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const STATUSES: CommentStatus[] = ["open", "in_progress", "done"];

/** PATCH /api/review/comments/[id] — edit body or change status. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { body?: string; status?: CommentStatus };
  const patch: Database["public"]["Tables"]["review_comments"]["Update"] = {};
  if (typeof body.body === "string") patch.body = body.body;
  if (body.status && STATUSES.includes(body.status)) {
    patch.status = body.status;
    patch.resolved_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // RLS scopes the update to comments inside the owner's projects.
  const { error } = await supabase.from("review_comments").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/review/comments/[id] — delete a comment (annotations cascade). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("review_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
