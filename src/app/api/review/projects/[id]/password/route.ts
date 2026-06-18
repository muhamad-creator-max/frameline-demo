import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

/** POST /api/review/projects/[id]/password — set or clear the share password. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { password } = (await req.json()) as { password: string | null };
  const password_hash = password ? hashPassword(password) : null;

  const { error } = await supabase
    .from("review_projects")
    .update({ password_hash })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
