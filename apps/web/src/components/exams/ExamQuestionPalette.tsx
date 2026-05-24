"use client";

import { twMerge } from "tailwind-merge";

interface ExamQuestionPaletteProps {
  total: number;
  currentIndex: number;
  answered: boolean[];
  onSelect: (index: number) => void;
}

export function ExamQuestionPalette({
  total,
  currentIndex,
  answered,
  onSelect,
}: ExamQuestionPaletteProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answered[i];

        const classes = twMerge(
          "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer",
          isCurrent
            ? "border-accent bg-accent text-primary-foreground"
            : isAnswered
              ? "border-badge-easy-text bg-badge-easy-bg text-badge-easy-text"
              : "border-border bg-surface text-muted hover:border-accent",
        );

        return (
          <button
            key={i}
            type="button"
            aria-label={`Ir para questão ${i + 1}`}
            aria-current={isCurrent || undefined}
            onClick={() => onSelect(i)}
            className={classes}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
