import { tv } from "tailwind-variants";

const badge = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  variants: {
    difficulty: {
      EASY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      MEDIUM: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      HARD: "bg-red-500/15 text-red-600 dark:text-red-400",
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
