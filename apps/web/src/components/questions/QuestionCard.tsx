import Link from "next/link";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import type { Question } from "@/lib/api/generated/types/Question";

interface QuestionCardProps {
  question: Question;
}

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <Link
      href={`/questions/${question.id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        <span className="text-xs text-muted">{question.subject.name}</span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs text-muted">{question.institution.name}</span>
        {question.year && (
          <>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{question.year}</span>
          </>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-foreground">
        {question.statement}
      </p>
      <p className="mt-2 text-xs text-muted">
        {question.alternatives.length} alternativas
      </p>
    </Link>
  );
}
