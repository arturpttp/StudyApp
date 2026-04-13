# Answer Flow — Design Spec

**Date:** 2026-04-13
**Step:** 6 from SPECS.md — "Fluxo de resposta — Enviar resposta, revelar explicação, salvar histórico"

---

## 1. Overview

Build the question detail page (`/questions/[id]`) where users read a question, eliminate unlikely alternatives, select an answer, submit it, and see the result with explanation. A timer tracks response time.

---

## 2. Architecture

### Approach: Hybrid RSC + Client

- **Server component** (`page.tsx`) fetches question data via Prisma — instant render, no loading spinner.
- **Client component** (`QuestionSolver`) handles all interactivity: selection, elimination, timer, submission (via Kubb mutation hook), and result reveal.

This follows the established project pattern: Server Components for initial data load, Client Components for interactivity.

---

## 3. Components

### 3.1 `app/(app)/questions/[id]/page.tsx` — Server Component

- Fetches question by ID via `@healthquest/db` (Prisma).
- Select: `id`, `statement`, `difficulty`, `year`, `subject { id, name }`, `institution { id, name }`, `alternatives { id, text, position }` ordered by position.
- Calls `notFound()` if question is missing or status !== ACTIVE.
- Renders:
  - Back link to `/questions`
  - Metadata bar: `DifficultyBadge`, subject name, institution name, year (if present)
  - `<QuestionSolver question={question} />` with the fetched data

### 3.2 `components/questions/QuestionSolver.tsx` — Client Component

**Props:**
```ts
interface QuestionSolverProps {
  question: {
    id: string;
    statement: string;
    alternatives: { id: string; text: string; position: number }[];
  };
}
```

**State:**
- `selectedId: string | null` — currently selected alternative
- `eliminatedIds: Set<string>` — alternatives the user has cut
- `result: { isCorrect: boolean; correctAlternativeId: string; explanation: string | null } | null`
- `elapsedMs: number` — display timer
- `startTime: number` — `Date.now()` ref captured on mount

**State machine (3 phases):**

1. **Answering** — timer ticking, alternatives interactive, submit enabled when `selectedId` is set.
2. **Submitting** — mutation in flight, all UI disabled, button shows loading state.
3. **Revealed** — timer stopped, result displayed, alternatives show correct/incorrect highlighting, explanation shown.

### 3.3 Alternative Row

Each alternative is rendered as a row with this layout:

```
[ Letter Badge ]  [ Scissors zone ]  [ Alternative text ........................ ]
```

**Left side — two overlapping elements in the same position:**

- **Letter badge (default):** A circle containing the alternative letter (A, B, C, D, E...) centered. Derived from `position` (0 → A, 1 → B, etc.). Acts as the radio indicator — on selection, fills with accent color and letter turns to primary-foreground.
- **Scissors icon (on hover):** When the user hovers over the left zone, the letter badge is replaced by a scissors icon (✂). Clicking it toggles elimination for that alternative.

**Clicking the row body** (outside the scissors zone) **selects** the alternative.

**Visual states per alternative:**

| State | Letter badge | Text | Row |
|---|---|---|---|
| Normal | `border-border`, letter in `text-foreground` | Normal | `hover:border-accent` |
| Selected | `bg-accent`, letter in contrasting color | Normal | `border-accent` |
| Eliminated | `opacity-50` | `line-through opacity-50` | `opacity-50` |
| Eliminated + Selected | Selected badge style + `opacity-50` | `line-through opacity-50` | `border-accent opacity-50` |
| Revealed — Correct | `bg-badge-easy-bg`, letter in `text-badge-easy-text` | Normal, bold | Green-tinted row |
| Revealed — User's wrong pick | `bg-badge-hard-bg`, letter in `text-badge-hard-text` | Normal | Red-tinted row |
| Revealed — Other | Muted styling | `text-muted` | Neutral |

After reveal: scissors icons disappear, eliminated alternatives keep `line-through` for retrospective review.

### 3.4 Timer Display

- Positioned in the top-right area of the question section.
- Format: `MM:SS` (e.g., `02:45`).
- Implementation: `useRef(Date.now())` for start time, `useState` + `setInterval(1000)` for display.
- Stops on submission. Final value remains visible in revealed state.
- `responseTime` sent to API = `Date.now() - startRef.current` at submit time.

### 3.5 Explanation Panel

Shown only in the **Revealed** phase, below the alternatives:

- Result banner: green "Resposta correta!" or red "Resposta incorreta" with icon.
- Explanation text rendered as markdown (the `explanation` field supports markdown per schema). Use a simple markdown renderer or render as plain text for now — markdown rendering can be enhanced later.
- If `explanation` is null, show only the result banner.

---

## 4. API Changes

### 4.1 Schema update

In `lib/api/schemas/questions.ts`, update `answerBodySchema`:

```ts
export const answerBodySchema = z.object({
  alternativeId: z.string().min(1, "alternativeId é obrigatório."),
  responseTime: z.number().int().min(0).optional().default(0),
});
```

### 4.2 Route handler update

In `app/api/v1/questions/[id]/answer/route.ts`, pass `responseTime` from parsed body:

```ts
await prisma.answerHistory.create({
  data: {
    userId: session.user.id,
    questionId,
    alternativeId,
    isCorrect: chosen.isCorrect,
    responseTime: parsed.data.responseTime,
  },
});
```

### 4.3 OpenAPI + Kubb regeneration

After schema change:
1. Run `pnpm generate:openapi` to update `openapi.json`
2. Run `pnpm kubb generate` to regenerate types and hooks
3. The mutation hook will then accept `responseTime` in the request body

---

## 5. Middleware Update

Add `/questions` to the matcher in `apps/web/middleware.ts`:

```ts
matcher: ["/dashboard/:path*", "/questions/:path*"]
```

This ensures the `[id]` page is protected by the auth middleware.

---

## 6. Testing Strategy

### Unit tests:
- Timer helper: formatting `elapsedMs` → `MM:SS` string
- Alternative letter derivation: position → letter mapping

### Integration tests:
- `POST /api/v1/questions/[id]/answer` with `responseTime` field — verify it persists correctly
- Existing answer tests should still pass (responseTime defaults to 0)

### Component tests (if jsdom is added later):
- QuestionSolver state transitions: answering → submitting → revealed
- Eliminate toggle behavior
- Timer starts and stops correctly

---

## 7. Files to create/modify

| Action | File |
|---|---|
| Create | `app/(app)/questions/[id]/page.tsx` |
| Create | `components/questions/QuestionSolver.tsx` |
| Modify | `lib/api/schemas/questions.ts` — add `responseTime` to answer schema |
| Modify | `app/api/v1/questions/[id]/answer/route.ts` — use `responseTime` from body |
| Modify | `middleware.ts` — add `/questions/:path*` to matcher |
| Regenerate | OpenAPI spec + Kubb output |
| Create | `__tests__/unit/timer.test.ts` |
| Create | `__tests__/integration/questions-answer-responsetime.test.ts` (or extend existing) |

---

## 8. Theme support

All new components use semantic tokens only (`bg-surface`, `text-foreground`, `border-border`, `bg-badge-*-bg`, etc.). New color tokens may be needed for the result states:

- `--success-bg` / `--success-text` — for correct answer highlight (can reuse `badge-easy-*` tokens)
- `--error-bg` / `--error-text` — for wrong answer highlight (can reuse `badge-hard-*` tokens)

If existing badge tokens provide sufficient contrast, no new CSS variables needed.
