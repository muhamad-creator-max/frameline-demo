import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { responseId } = await req.json();
  const supabase = createAdminClient();

  const { data: response } = await supabase
    .from("responses")
    .select("id, started_at, guideline_id")
    .eq("id", responseId)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("share_slug")
    .eq("id", response.guideline_id)
    .maybeSingle();
  if (guideline?.share_slug !== slug) {
    return NextResponse.json({ error: "mismatch" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = new Date(response.started_at);

  await supabase
    .from("responses")
    .update({
      status: "submitted",
      submitted_at: now.toISOString(),
      duration_ms: now.getTime() - startedAt.getTime(),
    })
    .eq("id", responseId);

  return NextResponse.json({ ok: true });
}
