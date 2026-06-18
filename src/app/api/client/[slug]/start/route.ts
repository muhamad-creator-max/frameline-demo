import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json()) as { clientName: string; snapshotId?: string };
  if (!body.clientName?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, current_version, status")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!guideline) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (guideline.status !== "published" || guideline.current_version < 1) {
    return NextResponse.json({ error: "not published" }, { status: 409 });
  }

  // Always resolve snapshot server-side from the current version.
  // Anything the client sent in `body.snapshotId` is treated as a hint only.
  const { data: snap } = await supabase
    .from("guideline_snapshots")
    .select("id")
    .eq("guideline_id", guideline.id)
    .eq("version", guideline.current_version)
    .maybeSingle();
  if (!snap) return NextResponse.json({ error: "not published" }, { status: 409 });
  const snapshotId = snap.id;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip_hash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : null;

  const { data: response, error } = await supabase
    .from("responses")
    .insert({
      guideline_id: guideline.id,
      snapshot_id: snapshotId,
      client_name: body.clientName.trim(),
      user_agent: req.headers.get("user-agent") ?? null,
      ip_hash,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ responseId: response.id });
}
