"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEMES = ["light", "dark", "code"] as const;
type Theme = (typeof THEMES)[number];

const LABELS: Record<Theme, string> = {
  light: "Claro",
  dark: "Escuro",
  code: "Código",
};

function SunIcon() {
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
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
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function TerminalIcon() {
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
      aria-hidden="true"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

const ICONS: Record<Theme, ComponentType> = {
  light: SunIcon,
  dark: MoonIcon,
  code: TerminalIcon,
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface"
        aria-hidden="true"
      />
    );
  }

  const current: Theme = (THEMES as readonly string[]).includes(theme ?? "")
    ? (theme as Theme)
    : "light";
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const Icon = ICONS[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label="Alternar tema"
      title={`Tema atual: ${LABELS[current]}. Trocar para ${LABELS[next]}.`}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-foreground hover:bg-background"
    >
      <Icon />
    </button>
  );
}
