"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, ArrowRight, Sun, Moon } from "lucide-react";
import type { WorkflowSnapshotPayload } from "@/lib/supabase/database.types";
import { FrameMark } from "@/components/brand/frame-mark";
import { WorkflowRunner } from "./workflow-runner";
import { WorkflowThanks } from "./workflow-thanks";

type Stage = "password" | "name" | "run" | "done";

/** Local light/dark switch for the public viewer (mirrors the brief client flow). */
function useViewerTheme(): ["light" | "dark", () => void] {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const saved = (typeof localStorage !== "undefined" &&
      localStorage.getItem("frameline:viewer-theme")) as "light" | "dark" | null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("frameline:viewer-theme", theme); } catch {}
    const id = requestAnimationFrame(() => root.classList.remove("theme-switching"));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

function ThemeToggle({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      style={{
        width: 38, height: 38, borderRadius: 99,
        background: "var(--surface)", color: "var(--text-2)",
        border: "1px solid var(--border-raw)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function WorkflowClientFlow({
  slug,
  title,
  requiresPassword,
  snapshot,
}: {
  slug: string;
  title: string;
  requiresPassword: boolean;
  snapshot: { id: string; payload: WorkflowSnapshotPayload } | null;
}) {
  const firstStage: Stage = requiresPassword ? "password" : "name";
  const [stage, setStage] = React.useState<Stage>(firstStage);
  const [unlockedSnapshot, setUnlockedSnapshot] =
    React.useState<{ id: string; payload: WorkflowSnapshotPayload } | null>(snapshot);
  const [clientName, setClientName] = React.useState("");
  const [responseId, setResponseId] = React.useState<string | null>(null);
  const [theme, toggleTheme] = useViewerTheme();

  return (
    <div
      className="workflow-dotted-bg"
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "var(--bg)",
        display: "flex", flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Top bar: brand · centered title · theme toggle */}
      <div
        style={{
          height: 56, padding: "0 24px",
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ justifySelf: "start" }}><FrameMark /></div>
        <h1
          style={{
            justifySelf: "center", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: "60vw", textAlign: "center",
          }}
        >
          {title}
        </h1>
        <div style={{ justifySelf: "end" }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <AnimatePresence mode="wait">
          {stage === "password" && (
            <FadeFrame key="password">
              <PasswordGate
                slug={slug}
                title={title}
                onUnlock={(snap) => { setUnlockedSnapshot(snap); setStage("name"); }}
              />
            </FadeFrame>
          )}

          {stage === "name" && (
            <FadeFrame key="name">
              <NameGate
                title={title}
                onStart={async (name) => {
                  setClientName(name);
                  try {
                    const res = await fetch(`/api/w/${slug}/start`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ clientName: name }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error ?? "Failed");
                    setResponseId(json.responseId);
                    setStage("run");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not start");
                  }
                }}
              />
            </FadeFrame>
          )}

          {stage === "run" && unlockedSnapshot && responseId && (
            <FadeFrame key="run">
              <WorkflowRunner
                slug={slug}
                snapshot={unlockedSnapshot.payload}
                responseId={responseId}
                onDone={() => setStage("done")}
              />
            </FadeFrame>
          )}

          {stage === "done" && (
            <FadeFrame key="done">
              <WorkflowThanks clientName={clientName} />
            </FadeFrame>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FadeFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ position: "absolute", inset: 0, display: "flex" }}
    >
      {children}
    </motion.div>
  );
}

function PasswordGate({
  slug, title, onUnlock,
}: {
  slug: string;
  title: string;
  onUnlock: (snap: { id: string; payload: WorkflowSnapshotPayload }) => void;
}) {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function unlock() {
    setLoading(true);
    setErr(false);
    try {
      const res = await fetch(`/api/w/${slug}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(true); return; }
      onUnlock({ id: json.snapshotId, payload: json.payload });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ maxWidth: 400, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-2)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{title}</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-2)" }}>This workflow is password protected.</p>
        </div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            autoFocus
            type="password"
            value={pw}
            placeholder="Enter password"
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            style={inputStyle(err)}
          />
          {err && <span style={{ fontSize: 12, color: "var(--danger)" }}>Incorrect password.</span>}
          <PrimaryAction onClick={unlock} disabled={!pw || loading}>Unlock <ArrowRight size={16} /></PrimaryAction>
        </div>
      </div>
    </div>
  );
}

function NameGate({ title, onStart }: { title: string; onStart: (name: string) => void }) {
  const [name, setName] = React.useState("");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ maxWidth: 460, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 400, color: "var(--text-2)" }}>
          Answer a few questions so we get your project exactly right — it only takes a minute.
        </p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          <input
            autoFocus
            value={name}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onStart(name.trim())}
            style={inputStyle(false)}
          />
          <PrimaryAction onClick={() => name.trim() && onStart(name.trim())} disabled={!name.trim()}>
            Begin <ArrowRight size={16} />
          </PrimaryAction>
        </div>
      </div>
    </div>
  );
}

function PrimaryAction({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "11px 18px", fontSize: 14, fontWeight: 500, borderRadius: "var(--r-md)",
        background: "var(--accent)", color: "var(--accent-contrast)",
        border: "1px solid transparent", boxShadow: "var(--glow)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function inputStyle(err: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: "var(--r-md)",
    background: "var(--surface)", border: "1.5px solid",
    borderColor: err ? "var(--danger)" : "var(--border-2)", color: "var(--text)",
    transition: "border-color .15s ease", textAlign: "start",
  };
}
