import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/review/guest";
import { buildSharedProjectPayload } from "@/lib/review/server";
import { GuestFlow } from "@/components/review/guest-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review", robots: { index: false, follow: false } };

/**
 * Public review share page. Service-role fetch by share slug. If the project is
 * password-protected and the guest hasn't unlocked, the GuestFlow renders the
 * password gate; otherwise we preload the listing. No account required.
 */
export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("review_projects")
    .select("id, name, password_hash, deleted_at")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!project || project.deleted_at) notFound();

  // Best-effort view bump.
  await supabase.rpc("increment_review_views", { p_slug: slug });

  const requiresPassword = !!project.password_hash;
  const session = await readGuestSession(slug);

  // Preload the listing only when no password is required (otherwise the guest
  // unlocks first via the API).
  let initial: Awaited<ReturnType<typeof buildSharedProjectPayload>> & {
    project: { id: string; name: string; description: string | null; allowDownload: boolean };
  } | null = null;
  if (!requiresPassword) {
    const payload = await buildSharedProjectPayload(project.id);
    const { data: full } = await supabase
      .from("review_projects")
      .select("description, allow_download")
      .eq("id", project.id)
      .maybeSingle();
    initial = {
      project: {
        id: project.id,
        name: project.name,
        description: full?.description ?? null,
        allowDownload: full?.allow_download ?? false,
      },
      ...payload,
    };
  }

  return (
    <GuestFlow
      slug={slug}
      projectName={project.name}
      requiresPassword={requiresPassword}
      initial={initial}
      initialGuestName={session?.name ?? null}
    />
  );
}
