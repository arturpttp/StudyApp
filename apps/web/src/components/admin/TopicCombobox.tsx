"use client";

import { useState, useMemo } from "react";
import { twMerge } from "tailwind-merge";

interface Topic {
  id: string;
  name: string;
}

interface TopicComboboxProps {
  topics: Topic[];
  selectedIds: string[];
  newNames: string[];
  onAddExisting: (id: string) => void;
  onRemoveExisting: (id: string) => void;
  onAddNew: (name: string) => void;
  onRemoveNew: (name: string) => void;
}

export function TopicCombobox({
  topics,
  selectedIds,
  newNames,
  onAddExisting,
  onRemoveExisting,
  onAddNew,
  onRemoveNew,
}: TopicComboboxProps) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return topics
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) && !selectedIds.includes(t.id),
      )
      .slice(0, 8);
  }, [query, topics, selectedIds]);

  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      topics.some((t) => t.name.toLowerCase() === q) ||
      newNames.some((n) => n.toLowerCase() === q)
    );
  }, [query, topics, newNames]);

  const selectedTopics = topics.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selectedTopics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onRemoveExisting(t.id)}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-primary-foreground cursor-pointer"
          >
            {t.name} ×
          </button>
        ))}
        {newNames.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onRemoveNew(n)}
            className="inline-flex items-center gap-1 rounded-full border border-accent bg-surface px-2 py-0.5 text-xs text-accent cursor-pointer"
          >
            + {n} ×
          </button>
        ))}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ou criar matéria..."
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      {query.trim() && (
        <div className="rounded border border-border bg-surface">
          {matches.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onAddExisting(t.id);
                setQuery("");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-background cursor-pointer"
            >
              {t.name}
            </button>
          ))}
          {!exactExists && (
            <button
              type="button"
              onClick={() => {
                onAddNew(query.trim());
                setQuery("");
              }}
              className={twMerge(
                "block w-full px-3 py-2 text-left text-sm text-accent cursor-pointer hover:bg-background",
                matches.length > 0 && "border-t border-border",
              )}
            >
              + Criar matéria "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
