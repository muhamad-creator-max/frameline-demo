import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newShareSlug } from "@/lib/utils";

export const runtime = "nodejs";

/** POST /api/workflows — create a blank workflow project (seeded with a Start node). */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workflow_projects")
    .insert({
      owner_id: user.id,
      title: "Untitled workflow",
      share_slug: newShareSlug(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }

  // Seed a Start node so the canvas isn't empty and the flow has an entry point.
  await supabase.from("workflow_nodes").insert({
    project_id: data.id,
    kind: "start",
    x: 80,
    y: 200,
    w: 150,
    h: 64,
    data: { label: "Start" },
  });

  return NextResponse.json({ id: data.id });
}
