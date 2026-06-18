"use client";

import * as React from "react";
import { Paperclip, Plus, Trash2, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBuilder, type SettingTarget } from "@/lib/guideline/store";
import type { Attachment, SettingCell } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nanoid } from "nanoid";

/**
 * Shared panel for editor-only settings (key/value cells) + attachments.
 * Used at both question level (default) and option level (override).
 */
export function SettingsCellsPanel({
  target,
  scope,
  settings,
  attachments,
  guidelineId,
}: {
  target: SettingTarget;
  scope: "question" | "option";
  settings: SettingCell[];
  attachments: Attachment[];
  guidelineId: string;
}) {
  const {
    addSettingCell,
    updateSettingCell,
    removeSettingCell,
    addAttachment,
    removeAttachment,
  } = useBuilder();

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind: Attachment["kind"] =
        ext === "cube" ? "lut" :
        ["lrtemplate", "xmp", "preset", "json", "prfpset", "prproj"].includes(ext) ? "preset" :
        file.type.startsWith("image/") ? (file.type.includes("gif") ? "gif" : "image") :
        file.type.startsWith("video/") ? "video" :
        "file";

      const form = new FormData();
      form.append("file", file);
      form.append("guidelineId", guidelineId);
      form.append("kind", kind);

      const res = await fetch("/api/uploads/bunny", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");

      addAttachment(target, {
        id: nanoid(8),
        name: json.name,
        url: json.url,
        kind: json.kind,
        size: json.size,
        provider: "bunny",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">
            {scope === "question" ? "Default settings" : "Settings for this option"}
          </h4>
          <p className="text-xs text-muted-foreground">
            Cells, LUTs, presets — shown to your editor, hidden from the client.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => addSettingCell(target)}>
          <Plus className="h-3.5 w-3.5" /> Add cell
        </Button>
      </div>

      {/* Cells */}
      <div className="flex flex-col gap-2">
        {settings.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              placeholder="Label (e.g. Exposure)"
              value={c.label}
              onChange={(e) => updateSettingCell(target, c.id, { label: e.target.value })}
              className="h-9"
            />
            <Input
              placeholder="Value (e.g. +0.4)"
              value={c.value}
              onChange={(e) => updateSettingCell(target, c.id, { value: e.target.value })}
              className="h-9 font-mono text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeSettingCell(target, c.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {settings.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            No cells yet. Add rows like “LUT → Kodak2383”, “Saturation → +12”.
          </p>
        )}
      </div>

      {/* Attachments */}
      <div className="flex items-center justify-between pt-2">
        <h4 className="text-sm font-medium">Attachments</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          Attach LUT / preset / file
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <AttachmentChip
            key={a.id}
            attachment={a}
            onRemove={() => removeAttachment(target, a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
      <a href={attachment.url} target="_blank" rel="noreferrer" className="max-w-[140px] truncate hover:underline">
        {attachment.name}
      </a>
      <span className="uppercase text-[10px] text-muted-foreground">{attachment.kind}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
