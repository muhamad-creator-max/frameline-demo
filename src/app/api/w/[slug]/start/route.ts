import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Begin a client run — creates an in-progress workflow_responses row. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json()) as { clientName: string };
  if (!body.clientName?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("workflow_projects")
    .select("id, current_version, status")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (project.status !== "published" || project.current_version < 1) {
    return NextResponse.json({ error: "not published" }, { status: 409 });
  }

  // Resolve the snapshot server-side from the current version.
  const { data: snap } = await supabase
    .from("workflow_snapshots")
    .select("id")
    .eq("project_id", project.id)
    .eq("version", project.current_version)
    .maybeSingle();
  if (!snap) return NextResponse.json({ error: "not published" }, { status: 409 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip_hash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : null;

  const { data: response, error } = await supabase
    .from("workflow_responses")
    .insert({
      project_id: project.id,
      snapshot_id: snap.id,
      client_name: body.clientName.trim(),
      user_agent: req.headers.get("user-agent") ?? null,
      ip_hash,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ responseId: response.id });
}
