import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bunnyPut } from "@/lib/bunny/client";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB (default)
// "gif" kind = animated reference: a short looping clip, capped tighter.
const ANIMATED_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * POST /api/uploads/bunny  (multipart/form-data)
 *   Form fields:
 *     file: File
 *     guidelineId: string
 *     kind: 'image' | 'gif' | 'lut' | 'preset' | 'file'
 *       ('gif' = animated reference, a short looping video clip ≤15 MB)
 *
 * Returns: { url, name, size, kind, provider: 'bunny' }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const guidelineId = form.get("guidelineId") as string | null;
    const kind = (form.get("kind") as string) || "file";

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (!guidelineId) return NextResponse.json({ error: "guidelineId required" }, { status: 400 });
    const limit = kind === "gif" ? ANIMATED_MAX_BYTES : MAX_BYTES;
    if (file.size > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      return NextResponse.json({ error: `File too large (max ${mb} MB)` }, { status: 413 });
    }

    // ownership check
    const { data: gl } = await supabase
      .from("guidelines")
      .select("id")
      .eq("id", guidelineId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!gl) return NextResponse.json({ error: "not found" }, { status: 404 });

    const ext = file.name.split(".").pop() ?? "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const remotePath = `guidelines/${guidelineId}/${newId()}-${safeName}`.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    const cdnUrl = await bunnyPut(remotePath, buf, file.type || "application/octet-stream");

    return NextResponse.json({
      url: cdnUrl,
      name: file.name,
      size: file.size,
      kind,
      provider: "bunny",
      ext,
    });
  } catch (err) {
    // Surface the real reason (e.g. missing Bunny env var, Bunny rejection,
    // body-parse failure) instead of a bare 500 → "Upload failed (500)".
    console.error("[uploads/bunny] failed:", err);
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
