"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useGetApiV1Subjects } from "@/lib/api/generated/hooks/useGetApiV1Subjects";
import { useGetApiV1Institutions } from "@/lib/api/generated/hooks/useGetApiV1Institutions";

interface FilterValues {
  subjectId: string | null;
  institutionId: string | null;
  difficulty: string | null;
  year: string | null;
}

interface FilterSidebarProps {
  filters: FilterValues;
  onFilterChange: <K extends keyof FilterValues>(
    key: K,
    value: FilterValues[K],
  ) => void;
  onClear: () => void;
}

const DIFFICULTIES = [
  { value: "EASY", label: "Fácil" },
  { value: "MEDIUM", label: "Médio" },
  { value: "HARD", label: "Difícil" },
];

export function FilterSidebar({
  filters,
  onFilterChange,
  onClear,
}: FilterSidebarProps) {
  const { data: subjects } = useGetApiV1Subjects();
  const { data: institutions } = useGetApiV1Institutions();

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <aside className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={onClear} className="text-xs">
            Limpar
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Especialidade</span>
          <Select
            value={filters.subjectId ?? ""}
            onChange={(e) =>
              onFilterChange("subjectId", e.target.value || null)
            }
            placeholder="Todas"
          >
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Instituição</span>
          <Select
            value={filters.institutionId ?? ""}
            onChange={(e) =>
              onFilterChange("institutionId", e.target.value || null)
            }
            placeholder="Todas"
          >
            {institutions?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Dificuldade</span>
          <Select
            value={filters.difficulty ?? ""}
            onChange={(e) =>
              onFilterChange("difficulty", e.target.value || null)
            }
            placeholder="Todas"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted">Ano</span>
          <Select
            value={filters.year ?? ""}
            onChange={(e) =>
              onFilterChange("year", e.target.value || null)
            }
            placeholder="Todos"
          >
            {Array.from({ length: 10 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              );
            })}
          </Select>
        </label>
      </div>
    </aside>
  );
}
