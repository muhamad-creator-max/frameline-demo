import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { resolveSharedProject } from "@/lib/review/guest";
import { buildSharedProjectPayload } from "@/lib/review/server";

export const runtime = "nodejs";

/**
 * POST /api/review/r/[slug]/unlock
 * Verifies the share password (if any) and returns the project listing
 * (folders + ready assets). No account needed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  const project = await resolveSharedProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (project.password_hash) {
    if (!password || !verifyPassword(project.password_hash, password)) {
      return NextResponse.json({ error: "wrong password" }, { status: 401 });
    }
  }

  const payload = await buildSharedProjectPayload(project.id);
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      allowDownload: project.allow_download,
    },
    ...payload,
  });
}
