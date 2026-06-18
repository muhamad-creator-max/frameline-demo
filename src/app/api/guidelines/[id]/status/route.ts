import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Status toggle from the list view: published <-> draft.
 * Setting "published" without a snapshot would break the client flow — we
 * silently fall back to draft if there's nothing to show.
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

  const { data: g } = await supabase
    .from("guidelines")
    .select("id, current_version")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!g) return NextResponse.json({ error: "not found" }, { status: 404 });

  let next = status;
  if (next === "published" && (g.current_version ?? 0) < 1) {
    return NextResponse.json(
      { error: "Open the brief and publish it first to create the first version" },
      { status: 400 },
    );
  }

  await supabase.from("guidelines").update({ status: next }).eq("id", id).eq("owner_id", user.id);
  return NextResponse.json({ ok: true });
}
