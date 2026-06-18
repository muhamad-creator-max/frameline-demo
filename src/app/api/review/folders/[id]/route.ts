import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/** PATCH /api/review/folders/[id] — rename or move (parent_id). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; parentId?: string | null };
  const patch: Database["public"]["Tables"]["review_folders"]["Update"] = {};
  if (typeof body.name === "string") patch.name = body.name.trim() || "New folder";
  if (body.parentId !== undefined) patch.parent_id = body.parentId;

  // RLS scopes this to folders inside the user's projects.
  const { error } = await supabase.from("review_folders").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/review/folders/[id] — hard delete (cascades to subfolders; assets unlink). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("review_folders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
