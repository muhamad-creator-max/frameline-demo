import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { password } = await req.json();
  const supabase = createAdminClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, password_hash, current_version, status")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!guideline || guideline.status === "archived") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (guideline.password_hash) {
    if (!password || !verifyPassword(guideline.password_hash, password)) {
      return NextResponse.json({ error: "wrong password" }, { status: 401 });
    }
  }

  const { data: snap } = await supabase
    .from("guideline_snapshots")
    .select("id, payload")
    .eq("guideline_id", guideline.id)
    .eq("version", guideline.current_version)
    .maybeSingle();

  if (!snap) return NextResponse.json({ error: "not published" }, { status: 404 });

  return NextResponse.json({ snapshotId: snap.id, payload: snap.payload });
}
