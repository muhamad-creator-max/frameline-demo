import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bunnyPut } from "@/lib/bunny/client";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/workflows/uploads/bunny  (multipart/form-data)
 *   Fields: file, projectId, kind ('image'|'video'|'gif'|'lut'|'preset'|'file')
 *   Returns: { url, name, size, kind, provider:'bunny' }
 *
 * Mirrors /api/uploads/bunny but scopes ownership to workflow_projects and files
 * to a workflows/<projectId>/ path.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const projectId = form.get("projectId") as string | null;
    const kind = (form.get("kind") as string) || "file";

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
    }

    // ownership check against workflow_projects
    const { data: proj } = await supabase
      .from("workflow_projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!proj) return NextResponse.json({ error: "not found" }, { status: 404 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const remotePath = `workflows/${projectId}/${newId()}-${safeName}`.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    const cdnUrl = await bunnyPut(remotePath, buf, file.type || "application/octet-stream");

    return NextResponse.json({ url: cdnUrl, name: file.name, size: file.size, kind, provider: "bunny" });
  } catch (err) {
    console.error("[workflows/uploads/bunny] failed:", err);
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
