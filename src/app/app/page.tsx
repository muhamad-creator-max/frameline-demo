import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FileText, Inbox, Eye, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: guidelines = [] }, { data: responses = [] }] = await Promise.all([
    supabase
      .from("guidelines")
      .select("id, title, status, view_count, current_version, updated_at")
      .eq("owner_id", user!.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("responses")
      .select("id, client_name, submitted_at, guideline:guidelines(title, owner_id)")
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const owned = (responses ?? []).filter(
    (r) => (r.guideline as { owner_id?: string } | null)?.owner_id === user!.id,
  );
  const publishedCount = (guidelines ?? []).filter((g) => g.status === "published").length;
  const totalViews = (guidelines ?? []).reduce((sum, g) => sum + (g.view_count ?? 0), 0);

  return (
    <PageShell title="Dashboard">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        <Stat icon={<FileText size={16} />} label="Active briefs" value={publishedCount} />
        <Stat icon={<Inbox size={16} />} label="Responses" value={owned.length} />
        <Stat icon={<Eye size={16} />} label="Total views" value={totalViews} />
      </div>

      <SectionHeader title="Recent activity" />
      {owned.length === 0 ? (
        <Card>
          <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <Sparkles size={20} style={{ marginBottom: 8, color: "var(--accent)" }} />
            <div>Nothing yet. Send a brief to a client to see activity here.</div>
          </div>
        </Card>
      ) : (
        <Card>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {owned.slice(0, 10).map((r, idx) => (
              <li
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--border-raw)",
                }}
              >
                <span
                  style={{
                    width: 26, height: 26, borderRadius: 99,
                    background: "var(--accent-weak)", color: "var(--accent-ink)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 11.5, flexShrink: 0,
                  }}
                >
                  {(r.client_name[0] ?? "?").toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{r.client_name}</strong>
                  <span style={{ color: "var(--text-2)" }}> submitted </span>
                  <span style={{ fontWeight: 500 }}>
                    {(r.guideline as { title?: string } | null)?.title ?? "a brief"}
                  </span>
                </span>
                <Link
                  href={`/app/responses/${r.id}`}
                  style={{
                    fontSize: 12, color: "var(--accent-ink)",
                    textDecoration: "none", fontWeight: 500,
                  }}
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}

function Stat({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--text-2)", fontSize: 12 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{value}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 32px 80px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 22 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
