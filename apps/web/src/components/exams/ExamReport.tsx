import { ExamReportItem } from "./ExamReportItem";

interface ExamReportProps {
  exam: {
    id: string;
    score: number;
    createdAt: string;
    finishedAt: string;
    questions: {
      questionId: string;
      order: number;
      statement: string;
      explanation: string | null;
      alternatives: { id: string; text: string; position: number }[];
      selectedAlternativeId: string | null;
      correctAlternativeId: string;
      isCorrect: boolean;
    }[];
  };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ExamReport({ exam }: ExamReportProps) {
  const correct = exam.questions.filter((q) => q.isCorrect).length;
  const total = exam.questions.length;
  const percent = Math.round(exam.score * 100);
  const duration = new Date(exam.finishedAt).getTime() - new Date(exam.createdAt).getTime();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Relatório do simulado</h2>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs uppercase text-muted">Acertos</p>
            <p className="text-2xl font-semibold text-foreground">
              {correct} / {total}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Pontuação</p>
            <p className="text-2xl font-semibold text-foreground">{percent}%</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Tempo</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatDuration(duration)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {exam.questions.map((q, i) => (
          <ExamReportItem key={q.questionId} index={i} question={q} />
        ))}
      </div>
    </div>
  );
}
