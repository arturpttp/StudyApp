"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePostApiV1QuestionsIdAnswer } from "@/lib/api/generated/hooks/usePostApiV1QuestionsIdAnswer";
import type { PostApiV1QuestionsIdAnswer200 } from "@/lib/api/generated/types/PostApiV1QuestionsIdAnswer";
import { formatTimer, positionToLetter } from "@/lib/question-utils";
import { Button } from "@/components/ui/Button";
import { AlternativeRow } from "./AlternativeRow";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

export interface PreviousAnswer {
  alternativeId: string;
  isCorrect: boolean;
  correctAlternativeId: string;
  explanation: string | null;
}

export interface QuestionSolverProps {
  question: {
    id: string;
    statement: string;
    alternatives: Alternative[];
  };
  previousAnswer?: PreviousAnswer | null;
}

type Phase = "answering" | "submitting" | "revealed";

export function QuestionSolver({ question, previousAnswer = null }: QuestionSolverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    previousAnswer?.alternativeId ?? null,
  );
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PostApiV1QuestionsIdAnswer200 | null>(
    previousAnswer ?? null,
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mutation = usePostApiV1QuestionsIdAnswer();
  const isSubmitting = mutation.isPending;
  const currentPhase: Phase = result ? "revealed" : isSubmitting ? "submitting" : "answering";

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startRef.current = Date.now();
    setElapsedMs(0);
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    if (!previousAnswer) {
      startTimer();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelect(altId: string) {
    if (currentPhase !== "answering") return;
    setSelectedId(altId);
  }

  function handleToggleEliminate(altId: string) {
    if (currentPhase !== "answering") return;
    setEliminatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(altId)) {
        next.delete(altId);
      } else {
        next.add(altId);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!selectedId || currentPhase !== "answering") return;
    const responseTime = Date.now() - startRef.current;
    stopTimer();

    mutation.mutate(
      { id: question.id, data: { alternativeId: selectedId, responseTime } },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: () => {
          startRef.current = Date.now() - responseTime;
          intervalRef.current = setInterval(() => {
            setElapsedMs(Date.now() - startRef.current);
          }, 1000);
        },
      },
    );
  }

  function handleReset() {
    setSelectedId(null);
    setEliminatedIds(new Set());
    setResult(null);
    mutation.reset();
    startTimer();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-4 flex items-start justify-between">
          <p className="flex-1 text-foreground whitespace-pre-wrap">{question.statement}</p>
          <span className="ml-4 shrink-0 font-mono text-sm text-muted">
            {formatTimer(elapsedMs)}
          </span>
        </div>

        <div className="space-y-2">
          {question.alternatives.map((alt) => (
            <AlternativeRow
              key={alt.id}
              alternative={alt}
              letter={positionToLetter(alt.position)}
              isSelected={selectedId === alt.id}
              isEliminated={eliminatedIds.has(alt.id)}
              phase={currentPhase}
              result={result}
              onSelect={handleSelect}
              onToggleEliminate={handleToggleEliminate}
            />
          ))}
        </div>

        {currentPhase === "answering" && (
          <Button
            className="mt-6 w-full"
            disabled={!selectedId}
            onClick={handleSubmit}
          >
            Responder
          </Button>
        )}
        {currentPhase === "submitting" && (
          <Button className="mt-6 w-full" disabled>
            Enviando...
          </Button>
        )}
      </div>

      {currentPhase === "revealed" && result && (
        <div
          className={`rounded-lg border p-6 ${
            result.isCorrect
              ? "border-badge-easy-text bg-badge-easy-bg"
              : "border-badge-hard-text bg-badge-hard-bg"
          }`}
        >
          <p
            className={`text-lg font-semibold ${
              result.isCorrect ? "text-badge-easy-text" : "text-badge-hard-text"
            }`}
          >
            {result.isCorrect ? "Resposta correta!" : "Resposta incorreta"}
          </p>
          {result.explanation && (
            <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">
              {result.explanation}
            </p>
          )}
          <Button variant="outline" className="mt-4" onClick={handleReset}>
            Refazer questão
          </Button>
        </div>
      )}
    </div>
  );
}
