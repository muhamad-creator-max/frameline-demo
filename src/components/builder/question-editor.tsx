"use client";

import * as React from "react";
import { Plus, Settings2, Trash2, Image as ImageIcon, Film, Type, FileImage } from "lucide-react";
import {
  useBuilder,
  type BuilderQuestion,
  type BuilderOption,
  type MediaKind,
} from "@/lib/guideline/store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SettingsCellsPanel } from "./settings-cells-panel";
import { MediaPicker } from "./media-picker";

export function QuestionEditor({
  question,
  guidelineId,
}: {
  question: BuilderQuestion;
  guidelineId: string;
}) {
  const { updateQuestion, addOption, updateOption, removeOption } = useBuilder();
  const [showQuestionSettings, setShowQuestionSettings] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Title + helper */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {question.kind === "choice"
            ? "Choice between options"
            : question.kind === "like"
              ? "Like or not"
              : "Open answer"}
        </span>
        <Input
          value={question.title}
          onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
          placeholder="Ask a question…"
          className="h-12 border-none bg-transparent px-0 text-2xl font-semibold focus:ring-0 placeholder:text-muted-foreground/40"
        />
        <Textarea
          value={question.helper}
          onChange={(e) => updateQuestion(question.id, { helper: e.target.value })}
          placeholder="Add a short description or instruction (optional)"
          rows={2}
          className="border-none bg-transparent px-0 text-sm focus:ring-0 placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Question-level toggles */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card/40 p-3">
        <ToggleRow
          label="Required"
          checked={question.required}
          onChange={(v) => updateQuestion(question.id, { required: v })}
        />
        <ToggleRow
          label="Show comment box"
          hint="AI-style composer at the bottom of the screen"
          checked={question.allow_comment}
          onChange={(v) => updateQuestion(question.id, { allow_comment: v })}
        />
        <div className="ms-auto">
          <Button
            variant={showQuestionSettings ? "default" : "secondary"}
            size="sm"
            onClick={() => setShowQuestionSettings((v) => !v)}
          >
            <Settings2 className="h-4 w-4" />
            Editor settings
          </Button>
        </div>
      </div>

      {/* Question-level settings (shared default for all options) */}
      {showQuestionSettings && (
        <Card className="p-4">
          <SettingsCellsPanel
            target={{ type: "question", questionId: question.id }}
            scope="question"
            settings={question.settings}
            attachments={question.attachments}
            guidelineId={guidelineId}
          />
        </Card>
      )}

      <Separator />

      {/* Options */}
      {question.kind === "choice" || question.kind === "like" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {question.kind === "like" ? "Items to react to" : "Options"}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addOption(question.id)}
            >
              <Plus className="h-4 w-4" /> Add option
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {question.options.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                onChange={(patch) => updateOption(question.id, opt.id, patch)}
                onDelete={() => removeOption(question.id, opt.id)}
                questionId={question.id}
                guidelineId={guidelineId}
              />
            ))}
          </div>

          {question.options.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No options yet. {question.kind === "like" ? "Add the visuals you want feedback on." : "Add some choices for the client to pick from."}
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          <p>Clients will see a single text field plus the comment composer.</p>
        </Card>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="font-medium">{label}</span>
      {hint && <span className="hidden text-xs text-muted-foreground md:inline">— {hint}</span>}
    </label>
  );
}

function OptionCard({
  option,
  onChange,
  onDelete,
  questionId,
  guidelineId,
}: {
  option: BuilderOption;
  onChange: (patch: Partial<BuilderOption>) => void;
  onDelete: () => void;
  questionId: string;
  guidelineId: string;
}) {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-secondary/40">
        <MediaPicker
          mediaKind={option.media_kind}
          mediaUrl={option.media_url}
          mediaProvider={option.media_provider ?? null}
          mediaMeta={option.media_meta}
          guidelineId={guidelineId}
          onChange={(patch) => onChange(patch)}
        />
        <MediaKindSwitcher
          value={option.media_kind}
          onChange={(k) => onChange({ media_kind: k, media_url: null, media_provider: null })}
        />
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={option.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Option label"
            className="h-9 flex-1 bg-transparent"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant={showSettings ? "default" : "secondary"}
          size="sm"
          onClick={() => setShowSettings((v) => !v)}
          className="self-start"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Editor settings {option.settings.length > 0 && `(${option.settings.length})`}
        </Button>

        {showSettings && (
          <div className="rounded-xl border border-border bg-background p-3">
            <SettingsCellsPanel
              target={{ type: "option", questionId, optionId: option.id }}
              scope="option"
              settings={option.settings}
              attachments={option.attachments}
              guidelineId={guidelineId}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function MediaKindSwitcher({
  value,
  onChange,
}: {
  value: MediaKind;
  onChange: (k: MediaKind) => void;
}) {
  const kinds: { kind: MediaKind; icon: React.ReactNode; label: string }[] = [
    { kind: "image", icon: <ImageIcon className="h-3.5 w-3.5" />, label: "Image" },
    { kind: "gif", icon: <FileImage className="h-3.5 w-3.5" />, label: "Animated" },
    { kind: "video", icon: <Film className="h-3.5 w-3.5" />, label: "Video" },
    { kind: "text", icon: <Type className="h-3.5 w-3.5" />, label: "Text" },
  ];
  return (
    <div className="absolute end-2 top-2 flex gap-1 rounded-full border border-border bg-background/80 p-1 backdrop-blur">
      {kinds.map((k) => (
        <button
          key={k.kind}
          type="button"
          onClick={() => onChange(k.kind)}
          aria-label={k.label}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors",
            value === k.kind && "bg-primary text-primary-foreground",
          )}
        >
          {k.icon}
        </button>
      ))}
    </div>
  );
}
