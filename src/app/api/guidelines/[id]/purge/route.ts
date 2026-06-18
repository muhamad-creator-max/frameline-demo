import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Permanently delete a guideline. Only allowed if already in trash. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: g } = await supabase
    .from("guidelines")
    .select("id, deleted_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!g) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!g.deleted_at) {
    return NextResponse.json({ error: "move to trash first" }, { status: 400 });
  }

  await supabase.from("guidelines").delete().eq("id", id).eq("owner_id", user.id);
  return NextResponse.json({ ok: true });
}
