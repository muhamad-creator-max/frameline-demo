import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkflowResponsesClient } from "@/components/workflow/workflow-responses-client";
import type { WorkflowSnapshotPayload, WorkflowAnswerValue, WorkflowNodeKind } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function WorkflowResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("id, title")
    .eq("id", id)
    .eq("owner_id", user!.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) notFound();

  // Responses (submitted first, newest first), plus their answers.
  const { data: responses } = await supabase
    .from("workflow_responses")
    .select("id, client_name, status, started_at, submitted_at, duration_ms, snapshot_id, path")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .limit(200);

  const responseIds = (responses ?? []).map((r) => r.id);
  const { data: answers } = responseIds.length
    ? await supabase
        .from("workflow_answers")
        .select("id, response_id, node_id, kind, value, comment_text")
        .in("response_id", responseIds)
    : { data: [] };

  // Snapshots referenced by these responses → so we can label answers with the
  // question titles / choices that existed when the client answered.
  const snapIds = [...new Set((responses ?? []).map((r) => r.snapshot_id))];
  const { data: snapshots } = snapIds.length
    ? await supabase.from("workflow_snapshots").select("id, payload").in("id", snapIds)
    : { data: [] };

  const snapById = new Map(
    (snapshots ?? []).map((s) => [s.id, s.payload as WorkflowSnapshotPayload]),
  );

  const rows = (responses ?? []).map((r) => ({
    id: r.id,
    client_name: r.client_name,
    status: r.status as "in_progress" | "submitted",
    started_at: r.started_at,
    submitted_at: r.submitted_at,
    duration_ms: r.duration_ms,
    path: Array.isArray(r.path) ? (r.path as string[]) : [],
    snapshot: snapById.get(r.snapshot_id) ?? null,
    answers: (answers ?? [])
      .filter((a) => a.response_id === r.id)
      .map((a) => ({
        id: a.id,
        node_id: a.node_id,
        kind: a.kind as WorkflowNodeKind,
        value: a.value as WorkflowAnswerValue,
        comment_text: a.comment_text,
      })),
  }));

  return <WorkflowResponsesClient projectId={project.id} title={project.title} rows={rows} />;
}
