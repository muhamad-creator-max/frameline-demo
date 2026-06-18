"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { User, Globe, CreditCard, Moon, Sun, Monitor, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n, type Locale } from "@/lib/i18n/provider";
import { CheckoutButton, ManageBillingButton } from "@/components/billing/billing-buttons";
import { PLANS } from "@/lib/stripe/plans";

interface ProfileShape {
  full_name: string;
  email: string;
  locale: Locale;
  plan: "free" | "pro" | "studio";
}

export function SettingsPageClient({
  profile,
  subscription,
}: {
  profile: ProfileShape;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
}) {
  const [tab, setTab] = React.useState<"profile" | "appearance" | "billing">("profile");

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "28px 32px 80px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 22 }}>Settings</h1>

        <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid var(--border-raw)" }}>
          <Tab active={tab === "profile"}    onClick={() => setTab("profile")}    icon={<User size={13} />}>Profile</Tab>
          <Tab active={tab === "appearance"} onClick={() => setTab("appearance")} icon={<Globe size={13} />}>Appearance</Tab>
          <Tab active={tab === "billing"}    onClick={() => setTab("billing")}    icon={<CreditCard size={13} />}>Billing</Tab>
        </div>

        {tab === "profile"    && <ProfileTab initial={profile} />}
        {tab === "appearance" && <AppearanceTab initialLocale={profile.locale} />}
        {tab === "billing"    && <BillingTab plan={profile.plan} subscription={subscription} />}
      </div>
    </div>
  );
}

function Tab({
  children, icon, active, onClick,
}: { children: React.ReactNode; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 12px",
        fontSize: 13, fontWeight: 500,
        background: "transparent", border: "none", cursor: "pointer",
        color: active ? "var(--text)" : "var(--text-3)",
        borderBottom: "2px solid",
        borderColor: active ? "var(--accent)" : "transparent",
        marginBottom: -1,
      }}
    >
      {icon} {children}
    </button>
  );
}

function ProfileTab({ initial }: { initial: ProfileShape }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [fullName, setFullName] = React.useState(initial.full_name);
  const [saving, setSaving] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  return (
    <Section title="Your profile">
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Full name">
          <input
            value={fullName} onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Email">
          <input value={initial.email} disabled style={{ ...inputStyle, opacity: 0.6 }} />
        </Field>
        <div>
          <button
            type="submit" disabled={saving}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: "var(--r-md)",
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: "1px solid transparent", boxShadow: "var(--glow)",
              fontWeight: 500, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving && <Loader2 className="animate-spin" size={13} />}
            Save changes
          </button>
        </div>
      </form>
    </Section>
  );
}

function AppearanceTab({ initialLocale }: { initialLocale: Locale }) {
  const { setLocale, locale } = useI18n();
  const { setTheme, theme } = useTheme();
  React.useEffect(() => { if (initialLocale !== locale) setLocale(initialLocale); }, [initialLocale, locale, setLocale]);

  return (
    <>
      <Section title="Theme">
        <div style={{ display: "flex", gap: 8 }}>
          {(["light", "dark", "system"] as const).map((t) => {
            const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "8px 14px", borderRadius: "var(--r-md)",
                  background: active ? "var(--surface)" : "var(--bg-2)",
                  color: active ? "var(--text)" : "var(--text-2)",
                  border: "1px solid", borderColor: active ? "var(--accent)" : "var(--border-raw)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                  textTransform: "capitalize",
                }}
              >
                <Icon size={13} /> {t}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Language">
        <div style={{ display: "flex", gap: 8 }}>
          {(["en", "ar"] as Locale[]).map((l) => {
            const active = locale === l;
            return (
              <button
                key={l}
                onClick={() => setLocale(l)}
                style={{
                  padding: "8px 14px", borderRadius: "var(--r-md)",
                  background: active ? "var(--surface)" : "var(--bg-2)",
                  color: active ? "var(--text)" : "var(--text-2)",
                  border: "1px solid", borderColor: active ? "var(--accent)" : "var(--border-raw)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                }}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function BillingTab({
  plan,
  subscription,
}: {
  plan: "free" | "pro" | "studio";
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
}) {
  return (
    <Section title="Plan">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-raw)",
            borderRadius: "var(--r-md)",
            padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>
              {plan} plan
            </div>
            {subscription?.current_period_end && (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </div>
            )}
          </div>
          {plan === "free" ? (
            <CheckoutButton priceId={PLANS.pro.priceMonthly ?? ""}>Upgrade to Pro</CheckoutButton>
          ) : (
            <ManageBillingButton />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {(["free", "pro", "studio"] as const).map((tier) => {
            const limits = PLANS[tier].limits;
            return (
              <div
                key={tier}
                style={{
                  border: "1px solid", borderColor: plan === tier ? "var(--accent)" : "var(--border-raw)",
                  background: plan === tier ? "var(--accent-weak)" : "var(--surface)",
                  borderRadius: "var(--r-md)", padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{PLANS[tier].name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {limits.guidelines === -1 ? "Unlimited" : limits.guidelines} guidelines
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {limits.monthlyResponses === -1 ? "Unlimited" : limits.monthlyResponses}/mo responses
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 11, fontWeight: 600,
          color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em",
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-2)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13.5,
  borderRadius: "var(--r-md)",
  background: "var(--surface)", border: "1px solid var(--border-2)",
  color: "var(--text)",
};
