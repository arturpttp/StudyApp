# Flashcards (SM-2 Review Loop) — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Summary

Implements the Flashcards study mode (step 8 of the HealthQuest development sequence). Users can create flashcards manually or directly from an answered question, organize them with `Topic`s (M:N), and review them via the SM-2 spaced-repetition algorithm. Review interface uses 4 rating buttons (Errei / Difícil / Médio / Fácil) mapped to SM-2 quality grades. Full CRUD plus a flip-card review session. No per-day limit; no historical review log in this iteration.

## Goals

1. Manual flashcard creation via a form (front + back + optional topics).
2. "Create flashcard from question" affordance on question detail pages (front/back pre-filled from the question's content).
3. Review session that flips cards and applies SM-2 updates per rating.
4. List, edit, and delete cards.
5. Cards organized by `Topic` (M:N), reusing the existing model.

## Non-Goals (deferred follow-ups)

- **Review history log** (`FlashcardReview` table) — Stats (step 9) will need this. Documented as a follow-up; spec ships with only current state on the card.
- Per-day card cap / new-card throttling.
- CSV/Anki deck import.
- Subdecks or hierarchical organization.
- Rich content (images, cloze deletions, markdown rendering).
- Admin pre-authored shared decks.

## Data Model

### Schema changes (`packages/db/prisma/schema.prisma`)

Replace the existing `Flashcard` model and add a back-relation on `Question`:

```prisma
model Flashcard {
  id          String    @id @default(cuid())
  user        User      @relation(fields: [userId], references: [id])
  userId      String
  front       String
  back        String
  // SM-2 state
  easeFactor  Float     @default(2.5)
  interval    Int       @default(0)    // days until next review
  repetitions Int       @default(0)    // consecutive q >= 3
  lastReview  DateTime?
  nextReview  DateTime                 // due if <= now
  // Organization and origin
  topics      Topic[]                  // implicit M:N
  question    Question? @relation(fields: [questionId], references: [id])
  questionId  String?
  createdAt   DateTime  @default(now())
}

model Question {
  // ... existing fields ...
  flashcards    Flashcard[]
}

model Topic {
  // ... existing fields ...
  flashcards Flashcard[]
}
```

Field changes from the current `Flashcard` model:
- Added: `interval`, `repetitions`, `topics`, `question`/`questionId`, `createdAt`
- Changed: `nextReview` is non-nullable (set to `now()` on create)
- Kept: `id`, `user`/`userId`, `front`, `back`, `easeFactor` (default 2.5), `lastReview`

### Migration

Schema change is breaking only if existing `Flashcard` rows exist with `nextReview = NULL`. None do (feature was never used). `db:push` suffices.

## SM-2 Algorithm

Pure module: `apps/web/src/lib/flashcards/sm2.ts`.

**Rating → quality grade:**

| Button | `q` |
|---|---|
| Errei | 0 |
| Difícil | 3 |
| Médio | 4 |
| Fácil | 5 |

**`applySm2(prev, q, now)` returns `{ easeFactor, interval, repetitions, lastReview, nextReview }`:**

```ts
if (q < 3) {
  repetitions = 0;
  interval = 1;             // next review tomorrow (avoids infinite loop in same session)
  // easeFactor unchanged
} else {
  repetitions = prev.repetitions + 1;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = 6;
  else interval = Math.round(prev.interval * prev.easeFactor);
  easeFactor = Math.max(
    1.3,
    prev.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
  );
}
nextReview = addDays(now, interval);
lastReview = now;
```

**New card defaults (at create time):** `easeFactor = 2.5`, `interval = 0`, `repetitions = 0`, `nextReview = now()` (immediately due, shows up in the first review session).

## API

All endpoints require auth via `requireAuth`. All queries scope by `userId = session.user.id`.

### `GET /api/v1/flashcards`

Query params:
| Param | Type | Notes |
|---|---|---|
| `dueOnly` | `"true" \| "false"` | default `"false"` |
| `topicIds` | repeated string | match-mode is always OR (any of) |

When `dueOnly=true`, filter `nextReview: { lte: now() }`. Order by `nextReview asc`.

Response: `Flashcard[]` with shape:
```ts
{
  id: string,
  front: string,
  back: string,
  easeFactor: number,
  interval: number,
  repetitions: number,
  lastReview: string | null,
  nextReview: string,
  topics: { id: string, name: string }[],
  questionId: string | null,
  createdAt: string,
}
```

### `GET /api/v1/flashcards/[id]`

Returns the single card (404 if not owned by session user).

### `POST /api/v1/flashcards`

Body:
```ts
{
  front: string,         // min 1
  back: string,          // min 1
  topicIds?: string[],   // default []
  questionId?: string,   // optional FK to Question
}
```

Creates the card with `nextReview = now()` and all SM-2 defaults. Validates `questionId` exists if provided (404 otherwise). Returns `{ id }` with 201.

### `PATCH /api/v1/flashcards/[id]`

Body:
```ts
{
  front?: string,
  back?: string,
  topicIds?: string[],
}
```

Updates content only — **does not touch SR state**. Returns 204. 404 if card not owned by user.

### `DELETE /api/v1/flashcards/[id]`

Returns 204. 404 if not owned.

### `PATCH /api/v1/flashcards/[id]/review`

Body:
```ts
{ rating: 0 | 3 | 4 | 5 }
```

Loads the card, runs `applySm2(card, rating, new Date())`, updates the row, returns the new state as `Flashcard`. 404 if not owned, 400 for invalid rating.

### Zod schemas

`apps/web/src/lib/api/schemas/flashcards.ts`:
- `flashcardsQuerySchema` — list query params
- `createFlashcardBodySchema` — POST
- `updateFlashcardBodySchema` — PATCH content
- `reviewFlashcardBodySchema` — `{ rating: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]) }`

## OpenAPI / Kubb

Register all 6 routes + `Flashcard` schema in `apps/web/scripts/generate-openapi.ts`. Regenerate Kubb hooks.

## UI

### Routes (under `app/(app)/`)

```
flashcards/
├── page.tsx              # landing
├── new/page.tsx          # create form
├── review/page.tsx       # review session
└── [id]/edit/page.tsx    # edit form
```

### Components (`apps/web/src/components/flashcards/`)

| Component | Type | Purpose |
|---|---|---|
| `FlashcardEditor` | client | Shared form: `front`, `back` textareas, `TopicMultiSelect`, hidden `questionId`. Used by `new` and `edit` pages; submit dispatches the appropriate Kubb mutation. |
| `FlashcardReviewer` | client | Flip card with CSS 3D transform; 4 rating buttons; "N de M" indicator; "Sessão concluída" terminal state. |
| `FlashcardCard` | server | List item: front snippet (truncated), topic chips, `Editar` / `Excluir` actions, `Due` badge if `nextReview <= now`. |
| `CreateFlashcardButton` | client | Button on `/questions/[id]`. Click → `router.push('/flashcards/new?questionId=X&front=...&back=...')`. Front pre-filled from the question's `statement`, back from the correct alternative's `text` + (if user already answered) the question's `explanation`. |

### `/flashcards` (landing — server)

Server component fetches:
- Count of due cards (`flashcard.count({ where: { userId, nextReview: { lte: now } } })`)
- Paginated list of all user's cards with `topics` included
- All topics (for filter sidebar)

Renders:
- Header with `"Você tem N cards para revisar agora."`
- Primary CTA `Começar revisão` → `/flashcards/review` (hidden when N === 0)
- Secondary CTA `+ Criar novo` → `/flashcards/new`
- Filter by topic (reuses `TopicMultiSelect`)
- List of `FlashcardCard`s with pagination

### `/flashcards/new` (create — server)

Server component fetches the user's topics for the editor. If query has `questionId`, fetch the question and pre-compute front/back defaults server-side and pass to `FlashcardEditor`. Submit redirects to `/flashcards`.

### `/flashcards/[id]/edit` (edit — server)

Fetches the card (404 if not owned), passes to `FlashcardEditor` in update mode.

### `/flashcards/review` (review — server + client)

Server component fetches due cards (`findMany` filtered by `nextReview <= now`, ordered by `nextReview asc`). Passes the frozen array to `FlashcardReviewer`. Client component:
- Tracks `currentIndex`, `flipped`
- Click card → flip back-side
- Rating button → `PATCH /[id]/review` then `currentIndex++` (no refetch)
- Cards rated "Errei" don't re-enter the queue this session (frozen list)
- After last card: "Sessão concluída — N revisados" + link back

### Navigation

Add a `<Link href="/flashcards">Flashcards</Link>` between Simulados and the Admin link in `apps/web/src/app/(app)/layout.tsx`.

### Theming

All UI uses semantic Tailwind tokens (`bg-background`, `bg-surface`, `text-foreground`, `text-muted`, `text-accent`, `border-border`, `text-danger`). 3-theme support inherited.

## Tests

### Unit
- `__tests__/unit/sm2.test.ts` — `applySm2` covering: new card sequence (q=5 five times), errei reset (q=0 → reps=0, interval=1), EF floor (1.3), EF growth (q=5 raises EF).
- `__tests__/unit/flashcard-schemas.test.ts` — Zod schemas for create/update/review (valid + invalid bodies).

### Integration (real Postgres, prefix `__test_fc_`)
- `flashcards-list.test.ts` — GET with/without `dueOnly`, topic filter, user-scoping (cards from another user not returned).
- `flashcards-create.test.ts` — POST creates with `nextReview = now`, optional `questionId` link, 404 on invalid question.
- `flashcards-update.test.ts` — PATCH content (does not touch SR state), DELETE returns 204, 404 for non-owner.
- `flashcards-review.test.ts` — PATCH /review with each rating value, validates evolution of `easeFactor`/`interval`/`repetitions`/`nextReview`, 400 on invalid rating.

All integration tests use `afterAll` cleanup matching the prefix (lesson learned from admin-questions leak).

## Risks & open questions

- **No review history:** Stats (step 9) charts like "revisões por dia" / "acurácia ao longo do tempo" are impossible until we add `FlashcardReview` log. Decision accepted — documented as the first follow-up of step 9.
- **Stale "frozen queue" in review:** if user opens review and another tab creates new due cards, they won't appear in the current session. Acceptable trade-off (sessions are short).
- **Errei → interval=1:** card reappears tomorrow, not later today. Standard SM-2 behavior; users wanting "see again in 10 min" need a different scheduler (Anki's "learning steps"). Not in MVP.
- **Pre-filling from question:** if the user hasn't yet answered the question, no `explanation` is shown in the back. Acceptable — they can still create the card with just the correct alternative.

## Out of scope (future iterations)

- `FlashcardReview` log model + endpoint to write it on each PATCH /review.
- Stats hooks (step 9 in the roadmap).
- Per-deck/topic per-day limits.
- CSV import for bulk authoring.
- Admin-curated shared decks.
- Learning steps (sub-day intervals for new/errei cards).
- Mobile gesture support (swipe to rate).
