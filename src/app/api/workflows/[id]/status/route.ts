import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Status toggle from the list view: published <-> draft. Publishing requires a
 * snapshot (current_version >= 1) so the public flow has something to render.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { status } = await req.json();
  if (!["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const { data: p } = await supabase
    .from("workflow_projects")
    .select("id, current_version")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (status === "published" && (p.current_version ?? 0) < 1) {
    return NextResponse.json(
      { error: "Open the workflow and publish it first to create the first version" },
      { status: 400 },
    );
  }

  await supabase.from("workflow_projects").update({ status }).eq("id", id).eq("owner_id", user.id);
  return NextResponse.json({ ok: true });
}
