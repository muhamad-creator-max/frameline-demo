"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FileText, Inbox, Trash2, Settings, Sparkles,
  ChevronDown, UserPlus, LogOut, RefreshCw, ChevronRight, Clapperboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { AIComposer } from "@/components/ai/ai-composer";

interface ShellProfile {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "studio";
}

interface RecentItem { id: string; title: string }
interface RecentResponse { id: string; client_name: string; guideline_title: string }

export function AppShell({
  profile,
  recentGuidelines,
  recentResponses,
  recentReviews = [],
  children,
}: {
  profile: ShellProfile;
  recentGuidelines: RecentItem[];
  recentResponses: RecentResponse[];
  recentReviews?: RecentItem[];
  children: React.ReactNode;
}) {
  const { dir } = useI18n();
  const [aiOpen, setAiOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAiOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      dir={dir}
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <Sidebar
        profile={profile}
        recentGuidelines={recentGuidelines}
        recentResponses={recentResponses}
        recentReviews={recentReviews}
        onOpenAi={() => setAiOpen(true)}
      />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {children}
      </main>

      <AIComposer open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

function Sidebar({
  profile,
  recentGuidelines,
  recentResponses,
  recentReviews,
  onOpenAi,
}: {
  profile: ShellProfile;
  recentGuidelines: RecentItem[];
  recentResponses: RecentResponse[];
  recentReviews: RecentItem[];
  onOpenAi: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [accountOpen, setAccountOpen] = React.useState(false);
  const [recentGOpen, setRecentGOpen] = React.useState(true);
  const [recentROpen, setRecentROpen] = React.useState(false);
  const [recentVOpen, setRecentVOpen] = React.useState(false);

  const workspaceName = `${profile.name.split(" ")[0] || "Your"}'s ${
    profile.plan === "studio" ? "Studio" : "Workspace"
  }`;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        background: "var(--bg-2)",
        borderInlineEnd: "1px solid var(--border-raw)",
        display: "flex",
        flexDirection: "column",
        padding: "10px 6px 6px",
        gap: 2,
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setAccountOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "6px 8px",
            borderRadius: 6,
            background: accountOpen ? "var(--surface)" : "transparent",
            color: "var(--text)",
            border: "none", cursor: "pointer",
            transition: "background .12s ease",
          }}
          onMouseEnter={(e) => { if (!accountOpen) e.currentTarget.style.background = "rgba(0,0,0,.04)"; }}
          onMouseLeave={(e) => { if (!accountOpen) e.currentTarget.style.background = "transparent"; }}
        >
          <span
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: "var(--accent)", color: "var(--accent-contrast)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 11, flexShrink: 0,
              boxShadow: "var(--glow)",
            }}
          >
            {(profile.name[0] ?? "F").toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 13.5, fontWeight: 500,
              flex: 1, textAlign: "start", minWidth: 0,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {workspaceName}
          </span>
          <ChevronDown size={14} style={{ color: "var(--text-3)" }} />
        </button>

        {accountOpen && (
          <AccountMenu
            profile={profile}
            workspaceName={workspaceName}
            onClose={() => setAccountOpen(false)}
            onSignOut={signOut}
          />
        )}
      </div>

      <div style={{ height: 10 }} />

      <NavLink href="/app" icon={Home} active={pathname === "/app"}>Dashboard</NavLink>
      <NavLink href="/app/guidelines" icon={FileText} active={pathname === "/app/guidelines" || pathname.startsWith("/app/guidelines/")}>Guidelines</NavLink>
      <NavLink href="/app/responses" icon={Inbox} active={pathname.startsWith("/app/responses")}>Responses</NavLink>
      <NavLink href="/app/review" icon={Clapperboard} active={pathname.startsWith("/app/review")}>Review</NavLink>

      <div style={{ height: 12 }} />

      <Section label="Recent guidelines" open={recentGOpen} onToggle={() => setRecentGOpen((v) => !v)}>
        {recentGuidelines.length === 0 ? (
          <Empty>No briefs yet</Empty>
        ) : (
          recentGuidelines.slice(0, 10).map((g) => (
            <SubLink
              key={g.id}
              href={`/app/guidelines/${g.id}`}
              active={pathname.includes(g.id)}
              icon={<FileText size={12} style={{ color: "var(--text-3)" }} />}
            >
              {g.title || "Untitled"}
            </SubLink>
          ))
        )}
      </Section>

      <Section label="Recent responses" open={recentROpen} onToggle={() => setRecentROpen((v) => !v)}>
        {recentResponses.length === 0 ? (
          <Empty>No responses yet</Empty>
        ) : (
          recentResponses.slice(0, 10).map((r) => (
            <SubLink
              key={r.id}
              href={`/app/responses/${r.id}`}
              active={pathname.includes(r.id)}
              icon={<Inbox size={12} style={{ color: "var(--text-3)" }} />}
            >
              {r.client_name}
            </SubLink>
          ))
        )}
      </Section>

      <Section label="Recent reviews" open={recentVOpen} onToggle={() => setRecentVOpen((v) => !v)}>
        {recentReviews.length === 0 ? (
          <Empty>No reviews yet</Empty>
        ) : (
          recentReviews.slice(0, 10).map((r) => (
            <SubLink
              key={r.id}
              href={`/app/review/${r.id}`}
              active={pathname.includes(r.id)}
              icon={<Clapperboard size={12} style={{ color: "var(--text-3)" }} />}
            >
              {r.title || "Untitled"}
            </SubLink>
          ))
        )}
      </Section>

      <div style={{ flex: 1 }} />

      <NavLink href="/app/trash" icon={Trash2} active={pathname.startsWith("/app/trash")}>Trash</NavLink>
      <NavLink href="/app/settings" icon={Settings} active={pathname.startsWith("/app/settings")}>Settings</NavLink>

      <div style={{ height: 6 }} />

      <button
        onClick={onOpenAi}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "9px 12px",
          margin: "0 2px 4px",
          borderRadius: 8,
          background: "var(--accent)",
          color: "var(--accent-contrast)",
          boxShadow: "var(--glow)",
          fontWeight: 500, fontSize: 13,
          border: "1px solid transparent", cursor: "pointer",
          transition: "filter .12s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.05)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = ""; }}
      >
        <Sparkles size={14} />
        <span style={{ flex: 1, textAlign: "start" }}>AI Assistant</span>
        <span
          className="mono"
          style={{ fontSize: 10, opacity: 0.85, padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.15)" }}
        >
          ⌘K
        </span>
      </button>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "5px 8px",
        borderRadius: 5,
        fontSize: 13.5, fontWeight: 500,
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
        textDecoration: "none",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        transition: "background .12s ease",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,.04)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={15} style={{ color: active ? "var(--accent)" : "var(--text-3)" }} />
      {children}
    </Link>
  );
}

function SubLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "4px 8px 4px 24px",
        borderRadius: 5, fontSize: 12.5,
        color: active ? "var(--text)" : "var(--text-2)",
        background: active ? "var(--surface)" : "transparent",
        textDecoration: "none",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,.04)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {children}
      </span>
    </Link>
  );
}

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "5px 8px",
          borderRadius: 5,
          fontSize: 11, fontWeight: 500,
          color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: ".08em",
          background: "transparent", border: "none", cursor: "pointer",
          width: "100%", textAlign: "start",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <ChevronRight
          size={11}
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform .15s ease",
          }}
        />
        {label}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: "3px 8px 3px 24px", fontSize: 12, color: "var(--text-3)" }}>
      {children}
    </span>
  );
}

function AccountMenu({
  profile,
  workspaceName,
  onClose,
  onSignOut,
}: {
  profile: ShellProfile;
  workspaceName: string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", insetInlineStart: 0, insetBlockStart: "calc(100% + 4px)",
        width: 280,
        background: "var(--surface)",
        border: "1px solid var(--border-raw)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-lg)",
        padding: 6,
        zIndex: 100,
      }}
    >
      <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--border-raw)", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--accent)", color: "var(--accent-contrast)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 12, boxShadow: "var(--glow)",
            }}
          >
            {(profile.name[0] ?? "F").toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {workspaceName}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              {profile.email} · {profile.plan} plan
            </div>
          </div>
        </div>
      </div>

      <MenuItem icon={UserPlus}>Invite members</MenuItem>
      <MenuItem icon={RefreshCw}>Switch workspace</MenuItem>
      <MenuItem icon={Settings} href="/app/settings" onClick={onClose}>Settings</MenuItem>
      <div style={{ height: 1, background: "var(--border-raw)", margin: "5px 4px" }} />
      <MenuItem icon={LogOut} onClick={() => { onClose(); onSignOut(); }} danger>
        Sign out
      </MenuItem>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  href,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <span
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 9px",
        borderRadius: 5,
        fontSize: 13,
        color: danger ? "var(--danger)" : "var(--text)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(229,72,77,.08)" : "rgba(0,0,0,.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={14} />
      {children}
    </span>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{ display: "block", width: "100%", background: "transparent", border: "none", padding: 0, textAlign: "start", cursor: "pointer" }}
    >
      {inner}
    </button>
  );
}
