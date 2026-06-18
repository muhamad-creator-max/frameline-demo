import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/** PATCH /api/review/projects/[id] — rename / toggle download. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; description?: string; allow_download?: boolean };
  const patch: Database["public"]["Tables"]["review_projects"]["Update"] = {};
  if (typeof body.name === "string") patch.name = body.name.trim() || "Untitled project";
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.allow_download === "boolean") patch.allow_download = body.allow_download;

  const { error } = await supabase
    .from("review_projects")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/review/projects/[id] — soft delete (trash). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("review_projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
