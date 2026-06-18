"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, Loader2, Paperclip, Languages } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/provider";

const SUGGESTIONS_EN = [
  "Cinematic brand film for a luxury watch — 6 questions, focus on color and tone",
  "TikTok ad creative brief for a skincare drop — quick, fun, 5 questions",
  "Wedding film editor onboarding for a couple — mood, pacing, music",
];

const SUGGESTIONS_AR = [
  "إعلان سينمائي لساعة فاخرة — ٦ أسئلة، التركيز على الألوان والمزاج",
  "موجز إبداعي لإعلان TikTok لمنتج عناية بالبشرة — ٥ أسئلة سريعة وممتعة",
  "موجز محرر فيديو حفل زفاف — المزاج، الإيقاع، الموسيقى",
];

export function AIComposer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const [prompt, setPrompt] = React.useState("");
  const [aiLocale, setAiLocale] = React.useState<"en" | "ar">(locale);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => setAiLocale(locale), [locale]);

  async function submit() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), locale: aiLocale }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI failed");
      toast.success("Brief generated");
      onClose();
      router.push(`/app/guidelines/${json.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            insetBlockEnd: 24,
            insetInlineStart: 268,
            width: 560,
            maxWidth: "calc(100vw - 300px)",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: 16,
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                background: "var(--accent-weak)",
                borderBottom: "1px solid var(--border-raw)",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: "var(--accent)", color: "var(--accent-contrast)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--glow)",
                }}
              >
                <Sparkles size={13} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
              <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                Describe the brief, I&apos;ll build it.
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setAiLocale((l) => (l === "en" ? "ar" : "en"))}
                title="Output language"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 8px",
                  borderRadius: 99, fontSize: 11,
                  background: "var(--surface)", color: "var(--text-2)",
                  border: "1px solid var(--border-raw)", cursor: "pointer",
                }}
              >
                <Languages size={11} />
                {aiLocale === "en" ? "EN" : "ع"}
              </button>
              <button
                onClick={onClose}
                style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4, display: "inline-flex" }}
              >
                <X size={14} />
              </button>
            </div>

            {prompt.trim().length === 0 && (
              <div style={{ padding: "12px 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="eyebrow">Suggestions</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(aiLocale === "ar" ? SUGGESTIONS_AR : SUGGESTIONS_EN).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      style={{
                        textAlign: aiLocale === "ar" ? "end" : "start",
                        padding: "8px 10px",
                        background: "var(--bg-2)",
                        border: "1px solid transparent",
                        borderRadius: 8,
                        fontSize: 12.5, color: "var(--text-2)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-raw)"; e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: 12 }}>
              <div
                style={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--border-raw)",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={
                    aiLocale === "ar"
                      ? "صف الموجز الذي تريد بناءه…"
                      : "Describe the brief you want to build…"
                  }
                  dir={aiLocale === "ar" ? "rtl" : "ltr"}
                  rows={3}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    resize: "none",
                    outline: "none",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--text)",
                    minHeight: 60,
                    maxHeight: 180,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    disabled
                    title="File attachments coming soon"
                    style={{
                      width: 30, height: 30, borderRadius: 99,
                      background: "transparent", color: "var(--text-3)",
                      border: "none", cursor: "not-allowed",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Paperclip size={15} />
                  </button>
                  <span style={{ flex: 1, fontSize: 11, color: "var(--text-3)" }}>
                    {aiLocale === "ar" ? "اضغط ⌘/Ctrl + Enter للإرسال" : "Press ⌘/Ctrl + Enter to send"}
                  </span>
                  <button
                    onClick={submit}
                    disabled={!prompt.trim() || loading}
                    style={{
                      width: 32, height: 32, borderRadius: 99,
                      background: prompt.trim() && !loading ? "var(--accent)" : "var(--bg-2)",
                      color: prompt.trim() && !loading ? "var(--accent-contrast)" : "var(--text-3)",
                      border: "1px solid",
                      borderColor: prompt.trim() && !loading ? "transparent" : "var(--border-raw)",
                      boxShadow: prompt.trim() && !loading ? "var(--glow)" : "none",
                      cursor: prompt.trim() && !loading ? "pointer" : "not-allowed",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
