import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: recentGuidelines }, { data: recentResponses }, { data: recentReviews }, { data: recentWorkflows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, email, plan")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("guidelines")
        .select("id, title")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("responses")
        .select("id, client_name, guideline:guidelines(title, owner_id)")
        .is("deleted_at", null)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("review_projects")
        .select("id, name")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("workflow_projects")
        .select("id, title")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

  // Filter responses to ones the user owns (RLS handles security, but the join
  // brings sibling responses that share guidelines we own).
  const ownedResponses = (recentResponses ?? [])
    .filter((r) => (r.guideline as { owner_id?: string } | null)?.owner_id === user.id)
    .map((r) => ({
      id: r.id,
      client_name: r.client_name,
      guideline_title: (r.guideline as { title?: string } | null)?.title ?? "",
    }));

  return (
    <AppShell
      profile={{
        id: user.id,
        name: profile?.full_name ?? profile?.email ?? "Editor",
        email: profile?.email ?? user.email ?? "",
        plan: profile?.plan ?? "free",
      }}
      recentGuidelines={(recentGuidelines ?? []).map((g) => ({ id: g.id, title: g.title }))}
      recentResponses={ownedResponses}
      recentReviews={(recentReviews ?? []).map((p) => ({ id: p.id, title: p.name }))}
      recentWorkflows={(recentWorkflows ?? []).map((w) => ({ id: w.id, title: w.title }))}
    >
      {children}
    </AppShell>
  );
}
