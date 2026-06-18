"use client";

import * as React from "react";
import { Paperclip, Send, ChevronLeft, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";

interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  kind: string;
  size?: number;
}

/**
 * Frameline-style PromptBox — rounded shell, attachment chips on top,
 * autogrowing textarea, attach + send pill on the bottom row.
 */
export function CommentComposer({
  slug,
  guidelineId,
  value,
  attachments,
  onChange,
  onSubmit,
  submitDisabled,
  showBack,
  onBack,
  isLast,
  submitting,
  placeholder,
  compact,
}: {
  slug: string;
  guidelineId: string;
  value: string;
  attachments: CommentAttachment[];
  onChange: (patch: { commentText?: string; commentAttachments?: CommentAttachment[] }) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  showBack: boolean;
  onBack: () => void;
  isLast: boolean;
  submitting: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  async function uploadFiles(files: FileList) {
    setUploading(true);
    try {
      const next: CommentAttachment[] = [...attachments];
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("slug", slug);
        form.append("guidelineId", guidelineId);
        form.append("kind", f.type.startsWith("image/") ? "image" : "file");
        const res = await fetch(`/api/client/${slug}/upload`, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        next.push({
          id: nanoid(8),
          name: json.name,
          url: json.url,
          kind: json.kind,
          size: json.size,
        });
      }
      onChange({ commentAttachments: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: string) {
    onChange({ commentAttachments: attachments.filter((a) => a.id !== id) });
  }

  const hasContent = !!value || attachments.length > 0;

  return (
    <div
      className="prompt-shell"
      style={{
        padding: compact ? "8px 8px 8px 16px" : "12px 12px 12px 18px",
      }}
    >
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {attachments.map((a) => (
            <span
              key={a.id}
              className="mono"
              style={{
                fontSize: 11, padding: "4px 9px", borderRadius: 99,
                background: "var(--bg-2)", color: "var(--text-2)",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Paperclip size={12} />
              <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              <button
                onClick={() => removeAttachment(a.id)}
                style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 0, display: "inline-flex" }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={placeholder ?? "Type a note, paste references, or attach files…"}
        onChange={(e) => onChange({ commentText: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !submitDisabled) {
            e.preventDefault();
            onSubmit();
          }
        }}
        style={{
          width: "100%", border: "none", background: "transparent", resize: "none",
          fontSize: 15, lineHeight: 1.5, color: "var(--text)",
          maxHeight: 160, display: "block", outline: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {showBack && (
            <button
              onClick={onBack}
              title="Previous question"
              style={{
                width: 32, height: 32, borderRadius: 99,
                background: "transparent", color: "var(--text-2)",
                border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 13, color: "var(--text-2)",
              padding: "7px 11px", borderRadius: 99,
              background: "transparent", border: "none", cursor: "pointer",
              transition: "background .15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {uploading ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
            Attach
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={submitDisabled}
          title={isLast ? "Submit" : "Next question"}
          style={{
            width: 36, height: 36, borderRadius: 99,
            background: hasContent && !submitDisabled ? "var(--accent)" : "var(--bg-2)",
            color: hasContent && !submitDisabled ? "var(--accent-contrast)" : "var(--text-3)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: hasContent && !submitDisabled ? "var(--glow)" : "none",
            border: "none", cursor: submitDisabled ? "not-allowed" : "pointer",
            transition: "all .15s ease",
          }}
        >
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
