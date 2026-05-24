"use client";

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { AlternativeRow } from "@/components/questions/AlternativeRow";
import { positionToLetter } from "@/lib/question-utils";

interface ExamReportItemProps {
  index: number;
  question: {
    questionId: string;
    statement: string;
    explanation: string | null;
    alternatives: { id: string; text: string; position: number }[];
    selectedAlternativeId: string | null;
    correctAlternativeId: string;
    isCorrect: boolean;
  };
}

export function ExamReportItem({ index, question }: ExamReportItemProps) {
  const [open, setOpen] = useState(false);

  const headerStatusClasses = question.isCorrect
    ? "text-badge-easy-text"
    : "text-badge-hard-text";

  const statusLabel = question.isCorrect
    ? "Correta"
    : question.selectedAlternativeId === null
      ? "Sem resposta"
      : "Incorreta";

  const pseudoResult = {
    isCorrect: question.isCorrect,
    correctAlternativeId: question.correctAlternativeId,
    explanation: question.explanation,
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            Q{index + 1}
          </span>
          <span className={twMerge("text-sm font-semibold", headerStatusClasses)}>
            {statusLabel}
          </span>
        </div>
        <span className="text-xs text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-foreground whitespace-pre-wrap">{question.statement}</p>
          <div className="space-y-2">
            {question.alternatives.map((alt) => (
              <AlternativeRow
                key={alt.id}
                alternative={alt}
                letter={positionToLetter(alt.position)}
                isSelected={question.selectedAlternativeId === alt.id}
                isEliminated={false}
                phase="revealed"
                result={pseudoResult}
                onSelect={() => {}}
                onToggleEliminate={() => {}}
              />
            ))}
          </div>
          {question.explanation && (
            <div className="rounded border border-border bg-background p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
