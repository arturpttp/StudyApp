"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePatchApiV1ExamsIdQuestionsQuestionid } from "@/lib/api/generated/hooks/usePatchApiV1ExamsIdQuestionsQuestionid";
import { usePatchApiV1ExamsIdFinish } from "@/lib/api/generated/hooks/usePatchApiV1ExamsIdFinish";
import { Button } from "@/components/ui/Button";
import { ExamTimer } from "./ExamTimer";
import { ExamQuestionPalette } from "./ExamQuestionPalette";
import { ExamQuestionPanel } from "./ExamQuestionPanel";
import { FinishExamDialog } from "./FinishExamDialog";

interface ExamQuestion {
  questionId: string;
  order: number;
  statement: string;
  alternatives: { id: string; text: string; position: number }[];
  selectedAlternativeId: string | null;
}

interface ExamRunnerProps {
  exam: {
    id: string;
    timeLimit: number | null;
    createdAt: string;
    questions: ExamQuestion[];
  };
}

export function ExamRunner({ exam }: ExamRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(exam.questions.map((q) => [q.questionId, q.selectedAlternativeId])),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const patchQuestion = usePatchApiV1ExamsIdQuestionsQuestionid();
  const finishMutation = usePatchApiV1ExamsIdFinish();
  const finishRequestedRef = useRef(false);

  const currentQuestion = exam.questions[currentIndex];
  const answered = useMemo(
    () => exam.questions.map((q) => selections[q.questionId] !== null && selections[q.questionId] !== undefined),
    [exam.questions, selections],
  );
  const unansweredCount = answered.filter((a) => !a).length;

  function handleSelect(alternativeId: string) {
    const questionId = currentQuestion.questionId;
    const previous = selections[questionId];
    const next = previous === alternativeId ? null : alternativeId;

    setSelections((prev) => ({ ...prev, [questionId]: next }));

    patchQuestion.mutate(
      { id: exam.id, questionId, data: { alternativeId: next } },
      {
        onError: () => {
          setSelections((prev) => {
            if (prev[questionId] === next) {
              return { ...prev, [questionId]: previous };
            }
            return prev;
          });
        },
      },
    );
  }

  function requestFinish() {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;
    finishMutation.mutate(
      { id: exam.id },
      {
        onSuccess: () => {
          router.refresh();
        },
        onError: () => {
          finishRequestedRef.current = false;
          router.refresh();
        },
      },
    );
  }

  function handleFinishClick() {
    setDialogOpen(true);
  }

  function handleConfirmFinish() {
    setDialogOpen(false);
    requestFinish();
  }

  function handleTimerExpire() {
    if (finishRequestedRef.current) return;
    requestFinish();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">
          Questão {currentIndex + 1} de {exam.questions.length}
        </div>
        <ExamTimer
          createdAt={exam.createdAt}
          timeLimit={exam.timeLimit}
          onExpire={handleTimerExpire}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <ExamQuestionPanel
          statement={currentQuestion.statement}
          alternatives={currentQuestion.alternatives}
          selectedAlternativeId={selections[currentQuestion.questionId] ?? null}
          onSelect={handleSelect}
        />

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(exam.questions.length - 1, i + 1))
            }
            disabled={currentIndex === exam.questions.length - 1}
          >
            Próxima
          </Button>
        </div>
      </div>

      <ExamQuestionPalette
        total={exam.questions.length}
        currentIndex={currentIndex}
        answered={answered}
        onSelect={setCurrentIndex}
      />

      <Button type="button" onClick={handleFinishClick} disabled={finishMutation.isPending}>
        Finalizar Simulado
      </Button>

      <FinishExamDialog
        open={dialogOpen}
        unansweredCount={unansweredCount}
        isSubmitting={finishMutation.isPending}
        onConfirm={handleConfirmFinish}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
