import { tv } from "tailwind-variants";

const badge = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  variants: {
    difficulty: {
      EASY: "bg-badge-easy-bg text-badge-easy-text",
      MEDIUM: "bg-badge-medium-bg text-badge-medium-text",
      HARD: "bg-badge-hard-bg text-badge-hard-text",
    },
  },
});

const labels: Record<string, string> = {
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
};

interface DifficultyBadgeProps {
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return <span className={badge({ difficulty })}>{labels[difficulty]}</span>;
}
