"use client";

import Link from "next/link";

interface CreateFlashcardButtonProps {
  questionId: string;
}

export function CreateFlashcardButton({ questionId }: CreateFlashcardButtonProps) {
  return (
    <Link
      href={`/flashcards/new?questionId=${questionId}`}
      className="inline-flex items-center rounded border border-border bg-surface px-3 py-1 text-xs text-foreground hover:border-accent transition-colors cursor-pointer"
    >
      + Criar flashcard
    </Link>
  );
}
