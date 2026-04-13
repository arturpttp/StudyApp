# Answer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the question detail page (`/questions/[id]`) with alternative selection, scissors-based elimination, response timer, answer submission, and explanation reveal.

**Architecture:** Hybrid RSC + Client. Server component fetches question data via Prisma for instant SSR. Client component (`QuestionSolver`) handles all interactivity using the Kubb-generated mutation hook.

**Tech Stack:** Next.js 16 (App Router), Prisma, Zod, Tailwind CSS + tailwind-variants, TanStack Query (Kubb-generated hooks), nuqs (not needed here)

---

### Task 1: Middleware — protect `/questions` routes

**Files:**
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/__tests__/unit/question-schemas.test.ts` (no change needed, just verify)

- [ ] **Step 1: Update middleware matcher**

In `apps/web/middleware.ts`, add `/questions/:path*` to the matcher array:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/questions/:path*"],
};
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `cd apps/web && pnpm vitest run __tests__/unit/question-schemas.test.ts`
Expected: All tests PASS (middleware change doesn't affect schema tests, but validates the test runner works)

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(auth): add /questions routes to middleware matcher"
```

---

### Task 2: API — accept `responseTime` in answer schema

**Files:**
- Modify: `apps/web/src/lib/api/schemas/questions.ts`
- Modify: `apps/web/__tests__/unit/question-schemas.test.ts`
- Modify: `apps/web/src/app/api/v1/questions/[id]/answer/route.ts`
- Modify: `apps/web/__tests__/integration/questions-answer.test.ts`

- [ ] **Step 1: Write failing unit tests for `responseTime` in `answerBodySchema`**

Add these tests to the `answerBodySchema` describe block in `apps/web/__tests__/unit/question-schemas.test.ts`:

```ts
it("accepts optional responseTime", () => {
  const result = answerBodySchema.safeParse({
    alternativeId: "alt123",
    responseTime: 5000,
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.responseTime).toBe(5000);
  }
});

it("defaults responseTime to 0 when omitted", () => {
  const result = answerBodySchema.safeParse({ alternativeId: "alt123" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.responseTime).toBe(0);
  }
});

it("rejects negative responseTime", () => {
  const result = answerBodySchema.safeParse({
    alternativeId: "alt123",
    responseTime: -1,
  });
  expect(result.success).toBe(false);
});

it("rejects non-integer responseTime", () => {
  const result = answerBodySchema.safeParse({
    alternativeId: "alt123",
    responseTime: 1.5,
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run __tests__/unit/question-schemas.test.ts`
Expected: FAIL — the new `responseTime` tests fail because the schema doesn't accept it yet

- [ ] **Step 3: Update `answerBodySchema` to accept `responseTime`**

In `apps/web/src/lib/api/schemas/questions.ts`, change the `answerBodySchema`:

```ts
export const answerBodySchema = z.object({
  alternativeId: z.string().min(1, "alternativeId é obrigatório."),
  responseTime: z.number().int().min(0).optional().default(0),
});
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `cd apps/web && pnpm vitest run __tests__/unit/question-schemas.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Write failing integration test for `responseTime` persistence**

Add this test to the describe block in `apps/web/__tests__/integration/questions-answer.test.ts`:

```ts
it("persists responseTime to answer history", async () => {
  const res = await POST(
    makeRequest(questionId, { alternativeId: correctAltId, responseTime: 4200 }),
    { params: Promise.resolve({ id: questionId }) },
  );
  expect(res.status).toBe(200);

  const latest = await prisma.answerHistory.findFirst({
    where: { userId: TEST_USER_ID, questionId },
    orderBy: { createdAt: "desc" },
  });
  expect(latest!.responseTime).toBe(4200);
});

it("defaults responseTime to 0 when not provided", async () => {
  const res = await POST(
    makeRequest(questionId, { alternativeId: correctAltId }),
    { params: Promise.resolve({ id: questionId }) },
  );
  expect(res.status).toBe(200);

  const latest = await prisma.answerHistory.findFirst({
    where: { userId: TEST_USER_ID, questionId },
    orderBy: { createdAt: "desc" },
  });
  expect(latest!.responseTime).toBe(0);
});
```

- [ ] **Step 6: Run integration test to verify it fails**

Run: `cd apps/web && pnpm vitest run __tests__/integration/questions-answer.test.ts`
Expected: FAIL — `responseTime` is still hardcoded to `0` in the route handler

- [ ] **Step 7: Update route handler to pass `responseTime` from body**

In `apps/web/src/app/api/v1/questions/[id]/answer/route.ts`, change the `prisma.answerHistory.create` call. Replace:

```ts
    responseTime: 0,
```

with:

```ts
    responseTime: parsed.data.responseTime,
```

- [ ] **Step 8: Run all answer tests to verify they pass**

Run: `cd apps/web && pnpm vitest run __tests__/integration/questions-answer.test.ts`
Expected: All tests PASS (including existing ones, since omitting `responseTime` defaults to `0`)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/api/schemas/questions.ts apps/web/src/app/api/v1/questions/\[id\]/answer/route.ts apps/web/__tests__/unit/question-schemas.test.ts apps/web/__tests__/integration/questions-answer.test.ts
git commit -m "feat(api): accept responseTime in answer submission"
```

---

### Task 3: OpenAPI + Kubb regeneration

**Files:**
- Modify: `apps/web/scripts/generate-openapi.ts`
- Regenerate: `apps/web/openapi.json`
- Regenerate: `apps/web/src/lib/api/generated/` (Kubb output)

- [ ] **Step 1: Update the OpenAPI registry to include `responseTime` in the answer body**

In `apps/web/scripts/generate-openapi.ts`, find the `POST /api/v1/questions/{id}/answer` path registration. Change the request body schema from:

```ts
          schema: z.object({
            alternativeId: z.string().min(1),
          }),
```

to:

```ts
          schema: z.object({
            alternativeId: z.string().min(1),
            responseTime: z.number().int().min(0).optional().default(0),
          }),
```

- [ ] **Step 2: Regenerate OpenAPI spec and Kubb types**

Run: `cd apps/web && pnpm generate:api`
Expected: Console outputs "OpenAPI spec written to ..." and Kubb generates updated files in `src/lib/api/generated/`

- [ ] **Step 3: Verify the generated mutation type now includes `responseTime`**

Run: `grep -n "responseTime" apps/web/src/lib/api/generated/types/PostApiV1QuestionsIdAnswer.ts`
Expected: A line containing `responseTime` in the mutation request type

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/generate-openapi.ts apps/web/openapi.json apps/web/src/lib/api/generated/
git commit -m "chore(api): regenerate OpenAPI spec with responseTime field"
```

---

### Task 4: Unit helpers — timer formatting and position-to-letter

**Files:**
- Create: `apps/web/src/lib/question-utils.ts`
- Create: `apps/web/__tests__/unit/question-utils.test.ts`

- [ ] **Step 1: Write failing tests for `formatTimer` and `positionToLetter`**

Create `apps/web/__tests__/unit/question-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatTimer, positionToLetter } from "@/lib/question-utils";

describe("formatTimer", () => {
  it("formats 0ms as 00:00", () => {
    expect(formatTimer(0)).toBe("00:00");
  });

  it("formats 59 seconds", () => {
    expect(formatTimer(59_000)).toBe("00:59");
  });

  it("formats 1 minute exactly", () => {
    expect(formatTimer(60_000)).toBe("01:00");
  });

  it("formats 5 minutes 30 seconds", () => {
    expect(formatTimer(330_000)).toBe("05:30");
  });

  it("formats 99 minutes 59 seconds", () => {
    expect(formatTimer(5_999_000)).toBe("99:59");
  });

  it("ignores sub-second precision", () => {
    expect(formatTimer(61_999)).toBe("01:01");
  });
});

describe("positionToLetter", () => {
  it("maps 0 to A", () => {
    expect(positionToLetter(0)).toBe("A");
  });

  it("maps 1 to B", () => {
    expect(positionToLetter(1)).toBe("B");
  });

  it("maps 4 to E", () => {
    expect(positionToLetter(4)).toBe("E");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run __tests__/unit/question-utils.test.ts`
Expected: FAIL — module `@/lib/question-utils` does not exist

- [ ] **Step 3: Implement the helpers**

Create `apps/web/src/lib/question-utils.ts`:

```ts
export function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function positionToLetter(position: number): string {
  return String.fromCharCode(65 + position);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run __tests__/unit/question-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/question-utils.ts apps/web/__tests__/unit/question-utils.test.ts
git commit -m "feat(utils): add formatTimer and positionToLetter helpers"
```

---

### Task 5: Server page — `questions/[id]/page.tsx`

**Files:**
- Create: `apps/web/src/app/(app)/questions/[id]/page.tsx`

- [ ] **Step 1: Create the server component page**

Create `apps/web/src/app/(app)/questions/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { QuestionSolver } from "@/components/questions/QuestionSolver";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuestionDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      statement: true,
      difficulty: true,
      year: true,
      subject: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true } },
      alternatives: {
        select: { id: true, text: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!question) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/questions"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        &larr; Banco de Questões
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        <span className="text-xs text-muted">{question.subject.name}</span>
        <span className="text-xs text-muted">&middot;</span>
        <span className="text-xs text-muted">{question.institution.name}</span>
        {question.year && (
          <>
            <span className="text-xs text-muted">&middot;</span>
            <span className="text-xs text-muted">{question.year}</span>
          </>
        )}
      </div>

      <QuestionSolver question={question} />
    </section>
  );
}
```

- [ ] **Step 2: Create a stub `QuestionSolver` so the page compiles**

Create `apps/web/src/components/questions/QuestionSolver.tsx`:

```tsx
"use client";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

export interface QuestionSolverProps {
  question: {
    id: string;
    statement: string;
    alternatives: Alternative[];
  };
}

export function QuestionSolver({ question }: QuestionSolverProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-foreground">{question.statement}</p>
      <p className="mt-4 text-sm text-muted">
        {question.alternatives.length} alternativas — implementação pendente
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page compiles by running the dev server**

Run: `cd apps/web && pnpm dev` (manually verify in browser at `/questions` then click a question — should see the detail page with the stub)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/questions/\[id\]/page.tsx apps/web/src/components/questions/QuestionSolver.tsx
git commit -m "feat(web): add question detail page with stub QuestionSolver"
```

---

### Task 6: QuestionSolver — full implementation

**Files:**
- Modify: `apps/web/src/components/questions/QuestionSolver.tsx`

**Depends on:** Task 7 (AlternativeRow) must be created first or simultaneously. Complete Task 7 before running this component.

This is the core interactive component. It replaces the stub from Task 5.

- [ ] **Step 1: Implement the complete `QuestionSolver` component**

Replace the contents of `apps/web/src/components/questions/QuestionSolver.tsx` with:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePostApiV1QuestionsIdAnswer } from "@/lib/api/generated/hooks/usePostApiV1QuestionsIdAnswer";
import type { PostApiV1QuestionsIdAnswer200 } from "@/lib/api/generated/types/PostApiV1QuestionsIdAnswer";
import { formatTimer, positionToLetter } from "@/lib/question-utils";
import { Button } from "@/components/ui/Button";
import { AlternativeRow } from "./AlternativeRow";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

export interface QuestionSolverProps {
  question: {
    id: string;
    statement: string;
    alternatives: Alternative[];
  };
}

type Phase = "answering" | "submitting" | "revealed";

export function QuestionSolver({ question }: QuestionSolverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PostApiV1QuestionsIdAnswer200 | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase: Phase = result ? "revealed" : selectedId !== null ? "answering" : "answering";

  const mutation = usePostApiV1QuestionsIdAnswer();
  const isSubmitting = mutation.isPending;
  const currentPhase: Phase = result ? "revealed" : isSubmitting ? "submitting" : "answering";

  // Timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  function handleSelect(altId: string) {
    if (currentPhase !== "answering") return;
    setSelectedId(altId);
  }

  function handleToggleEliminate(altId: string) {
    if (currentPhase !== "answering") return;
    setEliminatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(altId)) {
        next.delete(altId);
      } else {
        next.add(altId);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!selectedId || currentPhase !== "answering") return;
    const responseTime = Date.now() - startRef.current;
    stopTimer();

    mutation.mutate(
      { id: question.id, data: { alternativeId: selectedId, responseTime } },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: () => {
          // Re-start the timer if submission fails so the user can retry
          startRef.current = Date.now() - responseTime;
          intervalRef.current = setInterval(() => {
            setElapsedMs(Date.now() - startRef.current);
          }, 1000);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      {/* Statement + Timer */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-4 flex items-start justify-between">
          <p className="flex-1 text-foreground whitespace-pre-wrap">{question.statement}</p>
          <span className="ml-4 shrink-0 font-mono text-sm text-muted">
            {formatTimer(elapsedMs)}
          </span>
        </div>

        {/* Alternatives */}
        <div className="space-y-2">
          {question.alternatives.map((alt) => (
            <AlternativeRow
              key={alt.id}
              alternative={alt}
              letter={positionToLetter(alt.position)}
              isSelected={selectedId === alt.id}
              isEliminated={eliminatedIds.has(alt.id)}
              phase={currentPhase}
              result={result}
              onSelect={handleSelect}
              onToggleEliminate={handleToggleEliminate}
            />
          ))}
        </div>

        {/* Submit button */}
        {currentPhase === "answering" && (
          <Button
            className="mt-6 w-full"
            disabled={!selectedId}
            onClick={handleSubmit}
          >
            Responder
          </Button>
        )}
        {currentPhase === "submitting" && (
          <Button className="mt-6 w-full" disabled>
            Enviando...
          </Button>
        )}
      </div>

      {/* Result + Explanation */}
      {currentPhase === "revealed" && result && (
        <div
          className={`rounded-lg border p-6 ${
            result.isCorrect
              ? "border-badge-easy-text bg-badge-easy-bg"
              : "border-badge-hard-text bg-badge-hard-bg"
          }`}
        >
          <p
            className={`text-lg font-semibold ${
              result.isCorrect ? "text-badge-easy-text" : "text-badge-hard-text"
            }`}
          >
            {result.isCorrect ? "Resposta correta!" : "Resposta incorreta"}
          </p>
          {result.explanation && (
            <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">
              {result.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/questions/QuestionSolver.tsx
git commit -m "feat(web): implement QuestionSolver with timer, selection, and result reveal"
```

---

### Task 7: AlternativeRow component

**Files:**
- Create: `apps/web/src/components/questions/AlternativeRow.tsx`

- [ ] **Step 1: Create the `AlternativeRow` component**

Create `apps/web/src/components/questions/AlternativeRow.tsx`:

```tsx
import type { PostApiV1QuestionsIdAnswer200 } from "@/lib/api/generated/types/PostApiV1QuestionsIdAnswer";
import { twMerge } from "tailwind-merge";

interface AlternativeRowProps {
  alternative: { id: string; text: string; position: number };
  letter: string;
  isSelected: boolean;
  isEliminated: boolean;
  phase: "answering" | "submitting" | "revealed";
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

  // Row background and border
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

  // Badge classes
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

  // Text classes
  let textClasses = "flex-1 text-sm";
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
      {/* Scissors / Letter badge zone */}
      <div className="group/badge relative">
        {phase === "answering" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEliminate(alternative.id);
            }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-full opacity-0 group-hover/badge:opacity-100 transition-opacity cursor-pointer text-muted hover:text-foreground"
            aria-label={isEliminated ? `Restaurar alternativa ${letter}` : `Eliminar alternativa ${letter}`}
          >
            <ScissorsIcon />
          </button>
        )}
        <span className={badgeClasses}>{letter}</span>
      </div>

      {/* Clickable body for selection */}
      <button
        type="button"
        disabled={isDisabled || isRevealed}
        onClick={() => onSelect(alternative.id)}
        className={twMerge(textClasses, "text-left cursor-pointer disabled:cursor-default")}
      >
        {alternative.text}
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
```

- [ ] **Step 2: Verify in the browser**

Run the dev server (`pnpm dev`), navigate to `/questions`, click any question. Verify:
- The question statement renders with timer in top-right
- Alternatives show letter badges (A, B, C...)
- Hovering over the letter badge area reveals scissors icon
- Clicking scissors toggles elimination (opacity + line-through)
- Clicking the alternative text selects it (badge fills with accent)
- "Responder" button is disabled until an alternative is selected
- Submitting shows the correct/incorrect result and explanation
- Timer stops on submission

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/questions/AlternativeRow.tsx
git commit -m "feat(web): add AlternativeRow with scissors elimination and letter badges"
```

---

### Task 8: Theme verification & visual polish

**Files:**
- Possibly modify: `apps/web/src/app/globals.css` (only if new tokens needed)
- Possibly modify: `apps/web/src/components/questions/AlternativeRow.tsx` (tweaks)
- Possibly modify: `apps/web/src/components/questions/QuestionSolver.tsx` (tweaks)

- [ ] **Step 1: Test all three themes in the browser**

With the dev server running, navigate to `/questions/[id]` and switch between `light`, `dark`, and `code` themes. Verify for each theme:
- Statement text is readable
- Timer is visible but subdued (muted color)
- Letter badges have clear contrast
- Selected alternative accent color stands out
- Eliminated alternatives are visually muted with line-through
- Result banner (green for correct, red for incorrect) is legible
- Explanation text is readable on the colored background

- [ ] **Step 2: Fix any contrast issues found**

If the result explanation text is hard to read on `bg-badge-easy-bg` or `bg-badge-hard-bg`, adjust the text color in `QuestionSolver.tsx`'s explanation panel. For example, the explanation `<p>` may need to use `text-badge-easy-text` / `text-badge-hard-text` instead of `text-foreground` depending on theme contrast.

- [ ] **Step 3: Commit any theme fixes**

```bash
git add -u
git commit -m "fix(web): adjust answer flow theme contrast for all three themes"
```

(Skip this commit if no changes were needed.)

---

### Task 9: Full regression test run

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/web && pnpm vitest run __tests__/unit/`
Expected: All tests PASS

- [ ] **Step 2: Run all integration tests**

Run: `cd apps/web && pnpm vitest run __tests__/integration/`
Expected: All tests PASS

- [ ] **Step 3: Run TypeScript type check**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: If any failures, fix and commit**

Fix issues, then:
```bash
git add -u
git commit -m "fix(web): resolve test/type issues from answer flow"
```
