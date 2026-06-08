import Link from "next/link";
import { DeleteFlashcardButton } from "./DeleteFlashcardButton";

interface FlashcardCardProps {
  card: {
    id: string;
    front: string;
    back: string;
    nextReview: Date;
    topics: { id: string; name: string }[];
  };
}

function snippet(text: string, max = 140): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export function FlashcardCard({ card }: FlashcardCardProps) {
  const isDue = card.nextReview.getTime() <= Date.now();

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium text-foreground">{snippet(card.front)}</p>
          <p className="text-xs text-muted">{snippet(card.back)}</p>
        </div>
        {isDue && (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-primary-foreground">
            Due
          </span>
        )}
      </div>
      {card.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.topics.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs">
        <Link
          href={`/flashcards/${card.id}/edit`}
          className="text-accent hover:underline cursor-pointer"
        >
          Editar
        </Link>
        <DeleteFlashcardButton id={card.id} />
      </div>
    </div>
  );
}
