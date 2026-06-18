import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function ownerCheck(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data } = await supabase
    .from("responses")
    .select("id, guideline:guidelines(owner_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data || (data.guideline as { owner_id: string } | null)?.owner_id !== user.id) {
    return { ok: false as const, status: 404 };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerCheck(id);
  if (!r.ok) return NextResponse.json({ error: "denied" }, { status: r.status });
  await r.supabase
    .from("responses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerCheck(id);
  if (!r.ok) return NextResponse.json({ error: "denied" }, { status: r.status });
  await r.supabase.from("responses").update({ deleted_at: null }).eq("id", id);
  return NextResponse.json({ ok: true });
}
