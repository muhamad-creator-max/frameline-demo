import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkflowBuilderClient } from "@/components/workflow/workflow-builder-client";
import type { WorkflowCanvasState, WorkflowNodeData } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user!.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    supabase.from("workflow_nodes").select("*").eq("project_id", id),
    supabase.from("workflow_edges").select("*").eq("project_id", id),
  ]);

  const canvas: WorkflowCanvasState =
    project.canvas && typeof project.canvas === "object"
      ? (project.canvas as WorkflowCanvasState)
      : { x: 0, y: 0, zoom: 1 };

  return (
    <WorkflowBuilderClient
      project={{
        id: project.id,
        title: project.title,
        description: project.description ?? "",
        share_slug: project.share_slug,
        password_hash: project.password_hash,
        status: project.status,
      }}
      nodes={(nodes ?? []).map((n) => ({
        id: n.id,
        kind: n.kind,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        data: (n.data as WorkflowNodeData) ?? {},
      }))}
      edges={(edges ?? []).map((e) => ({
        id: e.id,
        source_node_id: e.source_node_id,
        source_port: e.source_port,
        target_node_id: e.target_node_id,
        target_port: e.target_port,
        label: e.label,
      }))}
      canvas={canvas}
    />
  );
}
