"use client";

import { useState } from "react";
import Link from "next/link";
import { usePatchApiV1FlashcardsIdReview } from "@/lib/api/generated/hooks/usePatchApiV1FlashcardsIdReview";
import { Button } from "@/components/ui/Button";

interface ReviewCard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardReviewerProps {
  cards: ReviewCard[];
}

const RATINGS: Array<{ rating: 0 | 3 | 4 | 5; label: string; variant: "danger" | "outline" | "primary" }> = [
  { rating: 0, label: "Errei", variant: "danger" },
  { rating: 3, label: "Difícil", variant: "outline" },
  { rating: 4, label: "Médio", variant: "outline" },
  { rating: 5, label: "Fácil", variant: "primary" },
];

export function FlashcardReviewer({ cards }: FlashcardReviewerProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const mutation = usePatchApiV1FlashcardsIdReview();

  const current = cards[index];
  const done = index >= cards.length;

  function handleRate(rating: 0 | 3 | 4 | 5) {
    if (!current) return;
    mutation.mutate(
      { id: current.id, data: { rating } },
      {
        onSettled: () => {
          setIndex((i) => i + 1);
          setFlipped(false);
        },
      },
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center space-y-3">
        <p className="text-foreground">Nada para revisar agora. 🎉</p>
        <Link
          href="/flashcards"
          className="inline-block text-sm text-accent hover:underline cursor-pointer"
        >
          Voltar
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center space-y-3">
        <p className="text-foreground">
          Sessão concluída — {cards.length} card{cards.length === 1 ? "" : "s"} revisado{cards.length === 1 ? "" : "s"}.
        </p>
        <Link
          href="/flashcards"
          className="inline-block text-sm text-accent hover:underline cursor-pointer"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted text-center">
        {index + 1} de {cards.length}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="block w-full rounded-lg border border-border bg-surface p-8 min-h-48 text-left transition-colors cursor-pointer hover:border-accent"
      >
        <p className="text-xs text-muted mb-2">
          {flipped ? "Verso" : "Frente"}
        </p>
        <p className="text-foreground whitespace-pre-wrap">
          {flipped ? current.back : current.front}
        </p>
        {!flipped && (
          <p className="text-xs text-muted mt-4 text-center">Clique para virar</p>
        )}
      </button>

      {flipped && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <Button
              key={r.rating}
              type="button"
              variant={r.variant}
              onClick={() => handleRate(r.rating)}
              disabled={mutation.isPending}
            >
              {r.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
