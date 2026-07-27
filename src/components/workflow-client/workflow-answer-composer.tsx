"use client";

import * as React from "react";
import { Paperclip, Send, X, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { WorkflowAnswerFile, QuestionAnswerConfig } from "@/lib/supabase/database.types";

/**
 * Question answer surface, styled like the brief PromptBox: attachment chips on
 * top, an autogrowing textarea, an optional link field, and attach + send on the
 * bottom row. Only the channels the editor enabled are shown.
 */
export function WorkflowAnswerComposer({
  slug,
  answer,
  text,
  link,
  files,
  onChange,
  onSubmit,
  submitDisabled,
  submitting,
  isTerminal,
}: {
  slug: string;
  answer: QuestionAnswerConfig | undefined;
  text: string;
  link: string;
  files: WorkflowAnswerFile[];
  onChange: (patch: { text?: string; link?: string; files?: WorkflowAnswerFile[] }) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitting: boolean;
  isTerminal: boolean;
}) {
  const a = answer ?? { text: true, image: false, video: false, link: false, file: false };
  const allowText = a.text;
  const allowLink = a.link;
  const allowUpload = a.image || a.video || a.file;

  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Build an accept string from the enabled upload kinds.
  const accept = [a.image ? "image/*" : "", a.video ? "video/*" : "", a.file ? "" : ""].filter(Boolean).join(",") || undefined;

  async function uploadFiles(list: FileList) {
    setUploading(true);
    try {
      const next: WorkflowAnswerFile[] = [...files];
      for (const f of Array.from(list)) {
        const form = new FormData();
        form.append("file", f);
        form.append("kind", f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file");
        const res = await fetch(`/api/w/${slug}/upload`, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        next.push({ id: nanoid(8), name: json.name, url: json.url, kind: json.kind, size: json.size });
      }
      onChange({ files: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(id: string) {
    onChange({ files: files.filter((f) => f.id !== id) });
  }

  return (
    <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 10 }}>
      {allowLink && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--surface)", border: "1px solid var(--border-2)" }}>
          <Link2 size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            value={link}
            onChange={(e) => onChange({ link: e.target.value })}
            placeholder="Paste a link (Figma, Drive, reference…)"
            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13.5, color: "var(--text)" }}
          />
        </div>
      )}

      <div
        style={{
          borderRadius: "var(--r-lg)", background: "var(--surface)",
          border: "1px solid var(--border-2)", boxShadow: "var(--shadow-sm)",
          padding: 10, display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {/* Attachment chips */}
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {files.map((f) => (
              <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 8px", borderRadius: 99, background: "var(--surface-2)", border: "1px solid var(--border-raw)" }}>
                <Paperclip size={12} style={{ color: "var(--text-3)" }} />
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button onClick={() => removeFile(f.id)} aria-label="Remove" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, display: "grid", placeItems: "center" }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {allowText && (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Type your answer here…"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !submitDisabled) onSubmit();
            }}
            style={{
              width: "100%", resize: "none", border: "none", background: "transparent",
              outline: "none", fontSize: 14, lineHeight: 1.5, color: "var(--text)", fontFamily: "inherit",
              minHeight: 24,
            }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {allowUpload ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-2)",
                background: "transparent", border: "1px solid var(--border-raw)", borderRadius: 99,
                padding: "6px 12px", cursor: "pointer",
              }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              Attach
            </button>
          ) : <span />}

          <button
            onClick={onSubmit}
            disabled={submitDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
              padding: "8px 16px", borderRadius: 99,
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: "1px solid transparent", boxShadow: "var(--glow)",
              cursor: submitDisabled ? "not-allowed" : "pointer", opacity: submitDisabled ? 0.5 : 1,
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isTerminal ? "Finish" : "Next"}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}
