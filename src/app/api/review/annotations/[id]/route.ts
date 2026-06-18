import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnnotationCoordinates, Database } from "@/lib/supabase/database.types";

type AnnotationUpdate = Database["public"]["Tables"]["annotations"]["Update"];

export const runtime = "nodejs";

/** PATCH /api/review/annotations/[id] — update geometry/color after editing. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    coordinates?: AnnotationCoordinates;
    color?: string;
    strokeWidth?: number;
  };
  const patch: AnnotationUpdate = {};
  if (body.coordinates) patch.coordinates_json = body.coordinates;
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.strokeWidth === "number") patch.stroke_width = body.strokeWidth;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // RLS scopes this to annotations inside the owner's projects.
  const { error } = await supabase.from("annotations").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/review/annotations/[id] — remove a single annotation. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("annotations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
