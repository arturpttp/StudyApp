"use client";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

export interface QuestionSolverProps {
  question: {
    id: string;
    statement: string;
    alternatives: Alternative[];
  };
}

export function QuestionSolver({ question }: QuestionSolverProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-foreground">{question.statement}</p>
      <p className="mt-4 text-sm text-muted">
        {question.alternatives.length} alternativas — implementação pendente
      </p>
    </div>
  );
}
