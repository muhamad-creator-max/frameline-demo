import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/password";
import type { WorkflowSnapshotPayload } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

/** Verify the share password and return the published snapshot payload. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { password } = await req.json();
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("id, password_hash, current_version, status")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!project || project.status === "archived") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (project.password_hash) {
    if (!password || !verifyPassword(project.password_hash, password)) {
      return NextResponse.json({ error: "wrong password" }, { status: 401 });
    }
  }

  const { data: snap } = await supabase
    .from("workflow_snapshots")
    .select("id, payload")
    .eq("project_id", project.id)
    .eq("version", project.current_version)
    .maybeSingle();

  if (!snap) return NextResponse.json({ error: "not published" }, { status: 404 });

  return NextResponse.json({
    snapshotId: snap.id,
    payload: snap.payload as WorkflowSnapshotPayload,
  });
}
