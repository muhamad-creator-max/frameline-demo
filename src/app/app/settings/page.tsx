import { createClient } from "@/lib/supabase/server";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", user!.id).maybeSingle(),
  ]);

  return (
    <SettingsPageClient
      profile={{
        full_name: profile?.full_name ?? "",
        email: profile?.email ?? user!.email ?? "",
        locale: (profile?.locale as "en" | "ar") ?? "en",
        plan: profile?.plan ?? "free",
      }}
      subscription={sub
        ? { plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end }
        : null}
    />
  );
}
