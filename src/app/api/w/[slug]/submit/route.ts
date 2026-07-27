import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Finalize a client run — marks submitted, records duration + the visited path. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json()) as { responseId: string; path?: string[] };
  const supabase = createAdminClient();

  const { data: response } = await supabase
    .from("workflow_responses")
    .select("id, started_at, project_id, status")
    .eq("id", body.responseId)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("share_slug")
    .eq("id", response.project_id)
    .maybeSingle();
  if (project?.share_slug !== slug) {
    return NextResponse.json({ error: "mismatch" }, { status: 400 });
  }

  // Idempotent: a re-submit just returns ok.
  if (response.status === "submitted") return NextResponse.json({ ok: true });

  const now = new Date();
  const startedAt = new Date(response.started_at);

  const { error } = await supabase
    .from("workflow_responses")
    .update({
      status: "submitted",
      submitted_at: now.toISOString(),
      duration_ms: now.getTime() - startedAt.getTime(),
      path: Array.isArray(body.path) ? body.path : [],
    })
    .eq("id", body.responseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
