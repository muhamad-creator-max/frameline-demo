import { createClient } from "@/lib/supabase/server";
import { GuidelinesPageClient } from "@/components/guidelines/guidelines-page-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function GuidelinesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use ?count=exact for pagination total. The questions join lets us count
  // questions per guideline cheaply in one round-trip.
  const { data: guidelines, count } = await supabase
    .from("guidelines")
    .select("id, title, description, status, view_count, updated_at, share_slug, current_version, questions(id)", { count: "exact" })
    .eq("owner_id", user!.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  const rows = (guidelines ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description ?? "",
    status: g.status as "draft" | "published" | "archived",
    share_slug: g.share_slug ?? "",
    current_version: g.current_version ?? 0,
    view_count: g.view_count ?? 0,
    updated_at: g.updated_at,
    question_count: Array.isArray(g.questions) ? g.questions.length : 0,
  }));

  return (
    <GuidelinesPageClient
      rows={rows}
      page={page}
      pageSize={PAGE_SIZE}
      total={count ?? 0}
    />
  );
}
