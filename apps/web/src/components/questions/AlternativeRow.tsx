import type { PostApiV1QuestionsIdAnswer200 } from "@/lib/api/generated/types/PostApiV1QuestionsIdAnswer";
import { twMerge } from "tailwind-merge";

interface AlternativeRowProps {
  alternative: { id: string; text: string; position: number };
  letter: string;
  isSelected: boolean;
  isEliminated: boolean;
  phase: "answering" | "submitting" | "revealed" | "exam-active";
  result: PostApiV1QuestionsIdAnswer200 | null;
  onSelect: (id: string) => void;
  onToggleEliminate: (id: string) => void;
}

export function AlternativeRow({
  alternative,
  letter,
  isSelected,
  isEliminated,
  phase,
  result,
  onSelect,
  onToggleEliminate,
}: AlternativeRowProps) {
  const isRevealed = phase === "revealed" && result !== null;
  const isCorrect = isRevealed && result.correctAlternativeId === alternative.id;
  const isWrongPick = isRevealed && isSelected && !result.isCorrect && result.correctAlternativeId !== alternative.id;
  const isDisabled = phase === "submitting";

  let rowClasses = "flex items-center gap-3 rounded-lg border p-3 transition-colors";
  if (isCorrect) {
    rowClasses = twMerge(rowClasses, "border-badge-easy-text bg-badge-easy-bg");
  } else if (isWrongPick) {
    rowClasses = twMerge(rowClasses, "border-badge-hard-text bg-badge-hard-bg");
  } else if (isRevealed) {
    rowClasses = twMerge(rowClasses, "border-border bg-surface opacity-60");
  } else if (isSelected) {
    rowClasses = twMerge(rowClasses, "border-accent bg-surface");
  } else {
    rowClasses = twMerge(rowClasses, "border-border bg-surface hover:border-accent");
  }

  if (isEliminated && !isRevealed) {
    rowClasses = twMerge(rowClasses, "opacity-50");
  }

  let badgeClasses = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold border transition-colors";
  if (isCorrect) {
    badgeClasses = twMerge(badgeClasses, "bg-badge-easy-bg text-badge-easy-text border-badge-easy-text");
  } else if (isWrongPick) {
    badgeClasses = twMerge(badgeClasses, "bg-badge-hard-bg text-badge-hard-text border-badge-hard-text");
  } else if (isSelected) {
    badgeClasses = twMerge(badgeClasses, "bg-accent text-primary-foreground border-accent");
  } else {
    badgeClasses = twMerge(badgeClasses, "border-border text-foreground");
  }

  let textClasses = "text-sm";
  if (isCorrect) {
    textClasses = twMerge(textClasses, "font-semibold text-badge-easy-text");
  } else if (isWrongPick) {
    textClasses = twMerge(textClasses, "text-badge-hard-text");
  } else if (isRevealed) {
    textClasses = twMerge(textClasses, "text-muted");
  } else {
    textClasses = twMerge(textClasses, "text-foreground");
  }

  if (isEliminated) {
    textClasses = twMerge(textClasses, "line-through");
  }

  return (
    <div className={rowClasses}>
      {phase === "answering" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleEliminate(alternative.id);
          }}
          className={twMerge(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors cursor-pointer hover:text-foreground",
            isEliminated ? "text-foreground" : "text-muted",
          )}
          aria-label={isEliminated ? `Restaurar alternativa ${letter}` : `Eliminar alternativa ${letter}`}
        >
          <ScissorsIcon />
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}

      <button
        type="button"
        disabled={isDisabled || isRevealed}
        onClick={() => onSelect(alternative.id)}
        className="flex flex-1 items-center gap-3 text-left cursor-pointer disabled:cursor-default"
      >
        <span className={badgeClasses}>{letter}</span>
        <span className={textClasses}>{alternative.text}</span>
      </button>
    </div>
  );
}

function ScissorsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
    </svg>
  );
}
