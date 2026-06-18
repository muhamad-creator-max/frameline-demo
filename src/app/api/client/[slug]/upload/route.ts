import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bunnyPut } from "@/lib/bunny/client";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const MAX = 25 * 1024 * 1024;

/**
 * Client-side (no-auth) attachment uploads — used by the comment composer.
 * We rate-limit by validating that the slug is a published, live brief.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, status")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!guideline || guideline.status !== "published") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kind = (form.get("kind") as string) || "file";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "file too large" }, { status: 413 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const remotePath = `responses/${guideline.id}/${newId()}-${safeName}`.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const url = await bunnyPut(remotePath, buf, file.type || "application/octet-stream");

  return NextResponse.json({
    url,
    name: file.name,
    size: file.size,
    kind,
    provider: "bunny",
  });
}
