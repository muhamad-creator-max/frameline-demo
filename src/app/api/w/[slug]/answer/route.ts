import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkflowAnswerValue, WorkflowNodeKind } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/** Upsert the client's answer for a single node (one row per node). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json()) as {
    responseId: string;
    nodeId: string;
    kind: WorkflowNodeKind;
    value: WorkflowAnswerValue;
    commentText?: string | null;
  };
  const supabase = createAdminClient();

  // Validate the response belongs to this slug and is still open.
  const { data: response } = await supabase
    .from("workflow_responses")
    .select("id, project_id, status")
    .eq("id", body.responseId)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (response.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("share_slug")
    .eq("id", response.project_id)
    .maybeSingle();
  if (project?.share_slug !== slug) {
    return NextResponse.json({ error: "mismatch" }, { status: 400 });
  }

  const { error } = await supabase.from("workflow_answers").upsert(
    {
      response_id: body.responseId,
      node_id: body.nodeId,
      kind: body.kind,
      value: body.value ?? {},
      comment_text: body.commentText ?? null,
    },
    { onConflict: "response_id,node_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
