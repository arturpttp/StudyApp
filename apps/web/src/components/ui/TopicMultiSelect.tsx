"use client";

import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

interface Topic {
  id: string;
  name: string;
}

interface TopicMultiSelectProps {
  topics: Topic[];
  selectedIds: string[];
  matchMode: "any" | "all";
  onToggle: (id: string) => void;
  onMatchModeChange: (mode: "any" | "all") => void;
  label?: string;
}

export function TopicMultiSelect({
  topics,
  selectedIds,
  matchMode,
  onToggle,
  onMatchModeChange,
  label = "Matérias",
}: TopicMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selectedTopics = topics.filter((t) => selectedIds.includes(t.id));
  const isLoading = topics.length === 0;

  const triggerLabel =
    selectedIds.length === 0
      ? "Selecionar matérias"
      : `${selectedIds.length} selecionada${selectedIds.length > 1 ? "s" : ""}`;

  return (
    <div ref={rootRef} className="relative space-y-2">
      <span className="block text-xs text-muted">{label}</span>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading}
        className={twMerge(
          "flex w-full items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm transition-colors cursor-pointer hover:border-accent disabled:cursor-default disabled:opacity-60",
          open && "border-accent",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedIds.length === 0 ? "text-muted" : "text-foreground"}>
          {isLoading ? "Carregando..." : triggerLabel}
        </span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && !isLoading && (
        <ul
          role="listbox"
          aria-multiselectable
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-border bg-surface shadow-lg"
        >
          {topics.map((t) => {
            const selected = selectedIds.includes(t.id);
            return (
              <li
                key={t.id}
                role="option"
                aria-selected={selected}
                onClick={() => onToggle(t.id)}
                className={twMerge(
                  "flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer hover:bg-background",
                  selected && "bg-background",
                )}
              >
                <span className={selected ? "text-accent font-medium" : "text-foreground"}>
                  {t.name}
                </span>
                {selected && <span className="text-accent">✓</span>}
              </li>
            );
          })}
        </ul>
      )}

      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTopics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className="inline-flex items-center gap-1 rounded-full border border-accent bg-surface px-2 py-0.5 text-xs text-accent cursor-pointer hover:bg-background"
              aria-label={`Remover ${t.name}`}
            >
              {t.name} ×
            </button>
          ))}
        </div>
      )}

      {selectedIds.length > 1 && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>Combinar:</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              checked={matchMode === "any"}
              onChange={() => onMatchModeChange("any")}
              className="cursor-pointer"
            />
            Qualquer
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              checked={matchMode === "all"}
              onChange={() => onMatchModeChange("all")}
              className="cursor-pointer"
            />
            Todas
          </label>
        </div>
      )}
    </div>
  );
}
