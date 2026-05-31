"use client";

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
  return (
    <div className="space-y-2">
      <span className="block text-xs text-muted">{label}</span>
      <div className="max-h-40 overflow-y-auto rounded border border-border bg-background p-2 space-y-1">
        {topics.length === 0 ? (
          <p className="text-xs text-muted">Carregando...</p>
        ) : (
          topics.map((t) => {
            const checked = selectedIds.includes(t.id);
            return (
              <label
                key={t.id}
                className={twMerge(
                  "flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-surface",
                  checked && "bg-surface",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(t.id)}
                  className="cursor-pointer"
                />
                <span className="text-foreground">{t.name}</span>
              </label>
            );
          })
        )}
      </div>
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
