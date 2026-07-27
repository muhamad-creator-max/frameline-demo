import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkflowSnapshotPayload } from "@/lib/supabase/database.types";
import { WorkflowClientFlow } from "@/components/workflow-client/workflow-client-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workflow" };

/**
 * Public client-facing page for a workflow. Service-role bypasses RLS, but we
 * only ever expose a *published snapshot*, never the editor's live draft.
 */
export default async function PublicWorkflowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("id, title, password_hash, status, current_version, deleted_at")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!project || project.deleted_at) notFound();

  // Best-effort view bump.
  await supabase.rpc("increment_workflow_views", { p_slug: slug });

  if (project.status !== "published" || project.current_version < 1) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">This workflow isn&apos;t ready yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The editor hasn&apos;t published it. Check back shortly, or reach out to them directly.
          </p>
        </div>
      </main>
    );
  }

  const requiresPassword = !!project.password_hash;

  let snapshot: { id: string; payload: WorkflowSnapshotPayload } | null = null;
  if (!requiresPassword) {
    const { data } = await supabase
      .from("workflow_snapshots")
      .select("id, payload")
      .eq("project_id", project.id)
      .eq("version", project.current_version)
      .maybeSingle();
    if (data) snapshot = { id: data.id, payload: data.payload as WorkflowSnapshotPayload };
  }

  return (
    <WorkflowClientFlow
      slug={slug}
      title={project.title}
      requiresPassword={requiresPassword}
      snapshot={snapshot}
    />
  );
}
