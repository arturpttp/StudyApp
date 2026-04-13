# Step 5 — Frontend Question Bank Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/questions` page — a filterable, paginated question bank that consumes the Kubb-generated React Query hooks, with URL-driven filter state via `nuqs`.

**Architecture:** A server component shell (`page.tsx`) renders the page heading and delegates to a client component (`QuestionBrowser`) that owns all interactive state. Filters live in URL search params via `nuqs`, which drives the `useGetApiV1Questions` hook. The `NuqsAdapter` wraps the app layout. Reusable UI components (`DifficultyBadge`, `Select`, `LoadingSkeleton`, `PaginationControl`) follow the existing `tailwind-variants` + `twMerge` pattern from `components/ui/`.

**Tech Stack:** Next.js 16 App Router, nuqs, @tanstack/react-query (via Kubb hooks), Tailwind CSS with semantic tokens, tailwind-variants, tailwind-merge.

---

## File Structure

```
apps/web/src/
├── app/(app)/
│   ├── layout.tsx                      # MODIFY — add NuqsAdapter wrapper
│   └── questions/
│       └── page.tsx                    # NEW — server shell for question bank
├── components/
│   ├── questions/
│   │   ├── QuestionBrowser.tsx         # NEW — client orchestrator (filters + list + pagination)
│   │   ├── FilterSidebar.tsx           # NEW — filter controls bound to nuqs
│   │   ├── QuestionCard.tsx            # NEW — single question preview card
│   │   └── QuestionListSkeleton.tsx    # NEW — loading placeholder
│   └── ui/
│       ├── Select.tsx                  # NEW — styled <select> matching Input pattern
│       ├── DifficultyBadge.tsx         # NEW — color-coded EASY/MEDIUM/HARD label
│       └── PaginationControl.tsx       # NEW — page navigation buttons

apps/web/__tests__/
├── unit/
│   ├── DifficultyBadge.test.tsx        # NEW
│   ├── PaginationControl.test.tsx      # NEW
│   └── Select.test.tsx                 # NEW
└── integration/
    └── QuestionBrowser.test.tsx        # NEW — renders with mocked hook, filters work
```

---

## Task 1: Install nuqs

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install nuqs**

```bash
cd /c/Programacao/JS/Study\ App
pnpm add nuqs --filter @healthquest/web
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add nuqs for URL search param state"
```

---

## Task 2: Add NuqsAdapter to app layout

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Wrap children with NuqsAdapter**

In `apps/web/src/app/(app)/layout.tsx`, add the import and wrap the outer `<div>`:

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";
```

Wrap the entire return JSX with `<NuqsAdapter>`:

```tsx
return (
  <NuqsAdapter>
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <Link href="/"><Image src="/logo.png" alt="HealthQuest" width={120} height={40} className="h-10 w-auto" priority /></Link>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{session.user.name ?? session.user.email}</span>
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  </NuqsAdapter>
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat(web): add NuqsAdapter to app layout"
```

---

## Task 3: Select component

**Files:**
- Create: `apps/web/src/components/ui/Select.tsx`
- Test: `apps/web/__tests__/unit/Select.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/unit/Select.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "@/components/ui/Select";

describe("Select", () => {
  it("renders with placeholder option", () => {
    render(
      <Select placeholder="Escolha...">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Escolha...")).toBeInTheDocument();
  });

  it("forwards value and onChange", () => {
    let captured = "";
    render(
      <Select value="b" onChange={(e) => (captured = e.target.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("b");
  });

  it("renders without placeholder when not provided", () => {
    render(
      <Select>
        <option value="x">X</option>
      </Select>,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run __tests__/unit/Select.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/ui/Select.tsx
import type { SelectHTMLAttributes } from "react";
import { tv } from "tailwind-variants";
import { twMerge } from "tailwind-merge";

const select = tv({
  base: "w-full rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none cursor-pointer appearance-none",
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

export function Select({
  placeholder,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <select className={twMerge(select(), className)} {...props}>
      {placeholder && (
        <option value="" disabled={!props.value && props.value !== ""}>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run __tests__/unit/Select.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Select.tsx apps/web/__tests__/unit/Select.test.tsx
git commit -m "feat(web): add Select UI component"
```

---

## Task 4: DifficultyBadge component

**Files:**
- Create: `apps/web/src/components/ui/DifficultyBadge.tsx`
- Test: `apps/web/__tests__/unit/DifficultyBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/unit/DifficultyBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";

describe("DifficultyBadge", () => {
  it("renders EASY with Portuguese label", () => {
    render(<DifficultyBadge difficulty="EASY" />);
    expect(screen.getByText("Fácil")).toBeInTheDocument();
  });

  it("renders MEDIUM with Portuguese label", () => {
    render(<DifficultyBadge difficulty="MEDIUM" />);
    expect(screen.getByText("Médio")).toBeInTheDocument();
  });

  it("renders HARD with Portuguese label", () => {
    render(<DifficultyBadge difficulty="HARD" />);
    expect(screen.getByText("Difícil")).toBeInTheDocument();
  });

  it("applies different styles per difficulty", () => {
    const { rerender } = render(<DifficultyBadge difficulty="EASY" />);
    const easy = screen.getByText("Fácil");
    expect(easy.className).not.toBe("");

    rerender(<DifficultyBadge difficulty="HARD" />);
    const hard = screen.getByText("Difícil");
    expect(hard.className).not.toBe(easy.className);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run __tests__/unit/DifficultyBadge.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/ui/DifficultyBadge.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run __tests__/unit/DifficultyBadge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/DifficultyBadge.tsx apps/web/__tests__/unit/DifficultyBadge.test.tsx
git commit -m "feat(web): add DifficultyBadge component"
```

---

## Task 5: PaginationControl component

**Files:**
- Create: `apps/web/src/components/ui/PaginationControl.tsx`
- Test: `apps/web/__tests__/unit/PaginationControl.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/unit/PaginationControl.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationControl } from "@/components/ui/PaginationControl";

describe("PaginationControl", () => {
  it("shows current page and total pages", () => {
    render(<PaginationControl page={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<PaginationControl page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Página anterior")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<PaginationControl page={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Próxima página")).toBeDisabled();
  });

  it("calls onPageChange with correct page", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<PaginationControl page={3} totalPages={5} onPageChange={handler} />);

    await user.click(screen.getByLabelText("Próxima página"));
    expect(handler).toHaveBeenCalledWith(4);

    await user.click(screen.getByLabelText("Página anterior"));
    expect(handler).toHaveBeenCalledWith(2);
  });

  it("hides when totalPages is 1", () => {
    const { container } = render(
      <PaginationControl page={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run __tests__/unit/PaginationControl.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/ui/PaginationControl.tsx
import { Button } from "./Button";

interface PaginationControlProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControl({
  page,
  totalPages,
  onPageChange,
}: PaginationControlProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 py-4" aria-label="Paginação">
      <Button
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        ←
      </Button>
      <span className="text-sm text-muted">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
      >
        →
      </Button>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run __tests__/unit/PaginationControl.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/PaginationControl.tsx apps/web/__tests__/unit/PaginationControl.test.tsx
git commit -m "feat(web): add PaginationControl component"
```

---

## Task 6: QuestionCard component

**Files:**
- Create: `apps/web/src/components/questions/QuestionCard.tsx`

- [ ] **Step 1: Write the component**

This is a presentational component that renders question preview info. No test needed beyond the integration test in Task 9, since it has no logic — only layout.

```tsx
// apps/web/src/components/questions/QuestionCard.tsx
import Link from "next/link";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import type { Question } from "@/lib/api/generated/types/Question";

interface QuestionCardProps {
  question: Question;
}

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <Link
      href={`/questions/${question.id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        <span className="text-xs text-muted">{question.subject.name}</span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs text-muted">{question.institution.name}</span>
        {question.year && (
          <>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{question.year}</span>
          </>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-foreground">
        {question.statement}
      </p>
      <p className="mt-2 text-xs text-muted">
        {question.alternatives.length} alternativas
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/questions/QuestionCard.tsx
git commit -m "feat(web): add QuestionCard component"
```

---

## Task 7: QuestionListSkeleton component

**Files:**
- Create: `apps/web/src/components/questions/QuestionListSkeleton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/questions/QuestionListSkeleton.tsx
export function QuestionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-surface p-4"
        >
          <div className="mb-2 flex gap-2">
            <div className="h-5 w-14 rounded-full bg-border" />
            <div className="h-5 w-24 rounded bg-border" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-3/4 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/questions/QuestionListSkeleton.tsx
git commit -m "feat(web): add QuestionListSkeleton loading component"
```

---

## Task 8: FilterSidebar component

**Files:**
- Create: `apps/web/src/components/questions/FilterSidebar.tsx`

- [ ] **Step 1: Write the component**

This component receives the current filter values and setters from the parent. It fetches subjects and institutions from the API to populate dropdowns.

```tsx
// apps/web/src/components/questions/FilterSidebar.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/questions/FilterSidebar.tsx
git commit -m "feat(web): add FilterSidebar component"
```

---

## Task 9: QuestionBrowser orchestrator

**Files:**
- Create: `apps/web/src/components/questions/QuestionBrowser.tsx`
- Test: `apps/web/__tests__/integration/QuestionBrowser.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/integration/QuestionBrowser.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock nuqs — return simple state hooks
vi.mock("nuqs", () => {
  const states: Record<string, string | null> = {};

  function useQueryState(key: string, _opts?: unknown) {
    const { useState } = require("react");
    const [val, setVal] = useState<string | null>(states[key] ?? null);
    return [
      val,
      (v: string | null | ((prev: string | null) => string | null)) => {
        const next = typeof v === "function" ? v(val) : v;
        states[key] = next;
        setVal(next);
      },
    ] as const;
  }

  return {
    useQueryState,
    parseAsString: { withDefault: () => ({}) },
    parseAsInteger: { withDefault: () => ({}) },
    parseAsStringEnum: () => ({ withDefault: () => ({}) }),
  };
});

// Mock the generated hooks
vi.mock("@/lib/api/generated/hooks/useGetApiV1Questions", () => ({
  useGetApiV1Questions: vi.fn().mockReturnValue({
    data: {
      data: [
        {
          id: "q1",
          statement: "What is the powerhouse of the cell?",
          difficulty: "EASY",
          year: 2024,
          subject: { id: "s1", name: "Biologia" },
          institution: { id: "i1", name: "USP" },
          alternatives: [
            { id: "a1", text: "Mitocôndria", position: 0 },
            { id: "a2", text: "Ribossomo", position: 1 },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/api/generated/hooks/useGetApiV1Subjects", () => ({
  useGetApiV1Subjects: vi.fn().mockReturnValue({
    data: [{ id: "s1", name: "Biologia" }],
  }),
}));

vi.mock("@/lib/api/generated/hooks/useGetApiV1Institutions", () => ({
  useGetApiV1Institutions: vi.fn().mockReturnValue({
    data: [{ id: "i1", name: "USP" }],
  }),
}));

import { QuestionBrowser } from "@/components/questions/QuestionBrowser";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("QuestionBrowser", () => {
  it("renders question cards from API data", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("What is the powerhouse of the cell?"),
      ).toBeInTheDocument();
    });
  });

  it("shows difficulty badge", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Fácil")).toBeInTheDocument();
    });
  });

  it("shows subject and institution metadata", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Biologia")).toBeInTheDocument();
      expect(screen.getByText("USP")).toBeInTheDocument();
    });
  });

  it("renders filter sidebar with labels", () => {
    render(<QuestionBrowser />, { wrapper });

    expect(screen.getByText("Filtros")).toBeInTheDocument();
    expect(screen.getByText("Especialidade")).toBeInTheDocument();
    expect(screen.getByText("Dificuldade")).toBeInTheDocument();
  });

  it("shows total count", async () => {
    render(<QuestionBrowser />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/1 questão/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run __tests__/integration/QuestionBrowser.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/questions/QuestionBrowser.tsx
"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useGetApiV1Questions } from "@/lib/api/generated/hooks/useGetApiV1Questions";
import { FilterSidebar } from "./FilterSidebar";
import { QuestionCard } from "./QuestionCard";
import { QuestionListSkeleton } from "./QuestionListSkeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import type { GetApiV1QuestionsQueryParams } from "@/lib/api/generated/types/GetApiV1Questions";

export function QuestionBrowser() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [subjectId, setSubjectId] = useQueryState("subjectId", parseAsString);
  const [institutionId, setInstitutionId] = useQueryState("institutionId", parseAsString);
  const [difficulty, setDifficulty] = useQueryState("difficulty", parseAsString);
  const [year, setYear] = useQueryState("year", parseAsString);

  const filters = { subjectId, institutionId, difficulty, year };

  const params: GetApiV1QuestionsQueryParams = {
    page,
    limit: 20,
    ...(subjectId && { subjectId }),
    ...(institutionId && { institutionId }),
    ...(difficulty && { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }),
    ...(year && { year: Number(year) }),
  };

  const { data, isLoading, error } = useGetApiV1Questions(params);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  function handleFilterChange(key: string, value: string | null) {
    const setters: Record<string, (v: string | null) => void> = {
      subjectId: setSubjectId,
      institutionId: setInstitutionId,
      difficulty: setDifficulty,
      year: setYear,
    };
    setters[key]?.(value);
    setPage(1); // reset to page 1 on filter change
  }

  function handleClearFilters() {
    setSubjectId(null);
    setInstitutionId(null);
    setDifficulty(null);
    setYear(null);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full shrink-0 lg:w-56">
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      <div className="flex-1 space-y-4">
        {data && (
          <p className="text-sm text-muted">
            {data.total} {data.total === 1 ? "questão" : "questões"} encontrada{data.total === 1 ? "" : "s"}
          </p>
        )}

        {isLoading && <QuestionListSkeleton />}

        {error && (
          <p className="text-sm text-danger">
            Erro ao carregar questões. Tente novamente.
          </p>
        )}

        {data && data.data.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            Nenhuma questão encontrada com os filtros selecionados.
          </p>
        )}

        {data && data.data.length > 0 && (
          <div className="space-y-3">
            {data.data.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}

        <PaginationControl
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run __tests__/integration/QuestionBrowser.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/questions/QuestionBrowser.tsx apps/web/__tests__/integration/QuestionBrowser.test.tsx
git commit -m "feat(web): add QuestionBrowser orchestrator with filters and pagination"
```

---

## Task 10: Questions page

**Files:**
- Create: `apps/web/src/app/(app)/questions/page.tsx`

- [ ] **Step 1: Create the server page shell**

```tsx
// apps/web/src/app/(app)/questions/page.tsx
import { QuestionBrowser } from "@/components/questions/QuestionBrowser";

export default function QuestionsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Banco de Questões
      </h1>
      <QuestionBrowser />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/questions/page.tsx
git commit -m "feat(web): add /questions page with question bank"
```

---

## Task 11: Add questions link to navigation

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Add nav link to the header**

In the `<header>` of `apps/web/src/app/(app)/layout.tsx`, add a `Banco de Questões` link after the logo:

```tsx
<header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
  <div className="flex items-center gap-6">
    <Link href="/"><Image src="/logo.png" alt="HealthQuest" width={120} height={40} className="h-10 w-auto" priority /></Link>
    <nav className="hidden items-center gap-4 text-sm sm:flex">
      <Link href="/questions" className="text-muted hover:text-foreground transition-colors">
        Banco de Questões
      </Link>
    </nav>
  </div>
  <div className="flex items-center gap-3 text-sm text-muted">
    <span>{session.user.name ?? session.user.email}</span>
    <ThemeSwitcher />
    <SignOutButton />
  </div>
</header>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat(web): add questions link to app navigation"
```

---

## Task 12: Run all tests and verify in browser

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && pnpm test
```

Expected: All tests pass (existing + new unit + integration tests).

- [ ] **Step 2: Start dev server and verify in browser**

```bash
cd apps/web && pnpm dev
```

Verify:
- Visit `http://localhost:3000/questions` — page loads, questions appear
- Filters work — selecting a subject/difficulty updates the URL and question list
- Pagination works — next/previous buttons update `?page=` in URL
- All three themes render correctly (toggle via ThemeSwitcher)
- Back/forward browser buttons respect filter state

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(web): polish question bank page after browser testing"
```
