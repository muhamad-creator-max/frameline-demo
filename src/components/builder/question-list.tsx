"use client";

import { ArrowDown, ArrowUp, GripVertical, ListChecks, MessageSquare, ThumbsUp, Trash2 } from "lucide-react";
import { useBuilder, type BuilderQuestion } from "@/lib/guideline/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  choice: ListChecks,
  like: ThumbsUp,
  answer: MessageSquare,
} as const;

export function QuestionList() {
  const { questions, selectedQuestionId, selectQuestion, removeQuestion, moveQuestion } = useBuilder();

  if (questions.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        No questions yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1">
      {questions.map((q, idx) => (
        <Item
          key={q.id}
          idx={idx}
          q={q}
          selected={selectedQuestionId === q.id}
          onSelect={() => selectQuestion(q.id)}
          onUp={() => moveQuestion(q.id, -1)}
          onDown={() => moveQuestion(q.id, 1)}
          onDelete={() => removeQuestion(q.id)}
        />
      ))}
    </ol>
  );
}

function Item({
  idx,
  q,
  selected,
  onSelect,
  onUp,
  onDown,
  onDelete,
}: {
  idx: number;
  q: BuilderQuestion;
  selected: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICON[q.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start transition-colors",
          selected
            ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
            : "hover:bg-secondary",
        )}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="grid h-6 w-6 place-items-center rounded-md bg-background text-[11px] font-medium text-muted-foreground">
          {idx + 1}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{q.title || "Untitled question"}</span>
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onUp(); }}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDown(); }}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      </button>
    </li>
  );
}
