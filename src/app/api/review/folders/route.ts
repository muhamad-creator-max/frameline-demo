import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/review/folders → { id }  Body: { projectId, parentId?, name? } */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { projectId, parentId, name } = await req.json().catch(() => ({}));
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Ownership check (RLS also enforces, but a clean 404 is nicer).
  const { data: project } = await supabase
    .from("review_projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("review_folders")
    .insert({ project_id: projectId, parent_id: parentId ?? null, name: name?.trim() || "New folder" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
