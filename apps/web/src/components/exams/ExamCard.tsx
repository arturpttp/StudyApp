import Link from "next/link";
import { twMerge } from "tailwind-merge";

interface ExamCardProps {
  exam: {
    id: string;
    status: "IN_PROGRESS" | "FINISHED";
    score: number | null;
    createdAt: Date;
    finishedAt: Date | null;
    questionCount: number;
    answeredCount: number;
  };
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ExamCard({ exam }: ExamCardProps) {
  const isActive = exam.status === "IN_PROGRESS";
  const statusLabel = isActive ? "Em andamento" : "Finalizado";
  const statusClasses = isActive
    ? "bg-badge-medium-bg text-badge-medium-text"
    : "bg-badge-easy-bg text-badge-easy-text";

  const actionLabel = isActive ? "Continuar" : "Ver relatório";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={twMerge(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
              statusClasses,
            )}
          >
            {statusLabel}
          </span>
          <span className="text-sm text-foreground">
            Simulado de {exam.questionCount} questões
          </span>
        </div>
        <p className="text-xs text-muted">
          Criado em {formatDate(exam.createdAt)}
          {exam.finishedAt && ` · Finalizado em ${formatDate(exam.finishedAt)}`}
        </p>
        {isActive ? (
          <p className="text-xs text-muted">
            Progresso: {exam.answeredCount} / {exam.questionCount} respondidas
          </p>
        ) : (
          exam.score !== null && (
            <p className="text-xs text-muted">
              Pontuação: {Math.round(exam.score * 100)}%
            </p>
          )
        )}
      </div>
      <Link
        href={`/exams/${exam.id}`}
        className="inline-flex items-center rounded border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-surface cursor-pointer"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
