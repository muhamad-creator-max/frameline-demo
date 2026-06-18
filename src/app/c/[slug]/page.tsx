import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuidelineSnapshotPayload } from "@/lib/supabase/database.types";
import { ClientFlow } from "@/components/client-flow/client-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brief" };

/**
 * Public client-facing page. Uses service-role to bypass RLS — we only
 * expose a *snapshot* of the published guideline, never the editor's raw drafts.
 */
export default async function ClientGuidelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, title, password_hash, status, current_version, deleted_at")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!guideline || guideline.deleted_at) notFound();

  // Bump view count (best-effort).
  await supabase.rpc("increment_guideline_views", { p_slug: slug });

  // Only "published" briefs are reachable; drafts/archived show a friendly notice.
  if (guideline.status !== "published" || guideline.current_version < 1) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">This brief isn't ready yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The editor hasn't published it. Check back shortly, or reach out to them directly.
          </p>
        </div>
      </main>
    );
  }

  const requiresPassword = !!guideline.password_hash;

  let snapshot: { id: string; payload: GuidelineSnapshotPayload } | null = null;
  if (!requiresPassword) {
    const { data } = await supabase
      .from("guideline_snapshots")
      .select("id, payload")
      .eq("guideline_id", guideline.id)
      .eq("version", guideline.current_version)
      .maybeSingle();
    if (data) snapshot = { id: data.id, payload: data.payload as GuidelineSnapshotPayload };
  }

  return (
    <ClientFlow
      slug={slug}
      guidelineId={guideline.id}
      title={guideline.title}
      requiresPassword={requiresPassword}
      snapshot={snapshot}
    />
  );
}
