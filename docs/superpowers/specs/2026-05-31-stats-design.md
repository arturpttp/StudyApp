# Estatísticas (Stats) — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Summary

Implements step 9 of the HealthQuest development sequence — a `/stats` page giving the user an at-a-glance overview of their study progress. Combines KPI cards (totals, accuracy, streak, this-week summary), a per-topic accuracy Radar Chart, and a per-exam line chart of scores over time. No schema changes; all data derived from existing `AnswerHistory` and `Exam` tables.

## Goals

1. Show overall + weekly question-answer KPIs (total answered, accuracy, streak).
2. Show a Radar Chart of accuracy by `Topic` (top 8 by answered count).
3. Show exam KPIs (total finished, average, best score) plus a line chart of scores by date.
4. Empty-state guidance when the user has no data yet.

## Non-Goals (deferred follow-ups)

- **Flashcard stats** — needs the `FlashcardReview` log (deferred in the flashcards spec).
- **Time-range toggle** (week / month / all). All-time is primary; a small "esta semana" complement card covers short-term feedback.
- **Drill-down** from radar axis to filtered question list.
- **Period comparison** ("up 5% vs last week").
- **Timezone-aware streak** — UTC day boundaries.
- **Subject (curso/Especialidade) radar** — Topic is more granular and informative; Subject view can be added later if requested.

## Data Sources

All from existing tables:

- `AnswerHistory` — `userId`, `questionId`, `isCorrect`, `createdAt`. Both bank-answer flow and exam-finish write rows here, so it's the single source of truth for "did the user engage today".
- `Question.topics` — for grouping accuracy by Topic via Prisma relation.
- `Exam` — `userId`, `status`, `score`, `finishedAt`.

No new models.

## API

All endpoints under `apps/web/src/app/api/v1/stats/`. All require `requireAuth`. All scoped by `userId = session.user.id`.

### `GET /api/v1/stats/overview`

Response:
```ts
{
  totalAnswered: number,         // count of AnswerHistory rows
  totalCorrect: number,
  accuracyAll: number,           // round((totalCorrect / totalAnswered) * 100), 0 if total=0
  totalAnsweredWeek: number,     // last 7 days (now - 7d ≤ createdAt)
  accuracyWeek: number,
  currentStreak: number,         // consecutive UTC days ending today with ≥1 AnswerHistory
}
```

### `GET /api/v1/stats/by-topic`

Response:
```ts
Array<{
  topicId: string,
  topicName: string,
  answered: number,
  correct: number,
  accuracy: number,              // 0–100, integer
}>
```

- Only topics where the user has answered ≥1 question.
- Sorted by `answered desc`, then `topicName asc`.
- Maximum 8 items (radar legibility).
- Implementation: one `AnswerHistory.findMany` joining `question.topics`, group in JS by topic.

### `GET /api/v1/stats/exams`

Response:
```ts
{
  totalFinished: number,
  avgScore: number,              // 0–100, integer, 0 if none
  bestScore: number,             // 0–100, integer, 0 if none
  scores: Array<{
    examId: string,
    date: string,                // ISO datetime (finishedAt)
    score: number,               // 0–100, integer
  }>,
}
```

- Only `Exam.status === "FINISHED"` with non-null `score` and `finishedAt`.
- `scores` ordered by `finishedAt asc` (chart left-to-right is chronological).
- `score` returned as integer 0–100 (Prisma stores as `Float` 0–1; multiply by 100 and round).

### Zod schemas

No request bodies. Response shapes documented in OpenAPI registration but not Zod-validated server-side (server is the authority).

## Pure modules

`apps/web/src/lib/stats/streak.ts`:

```ts
export function computeStreak(dates: Date[], now: Date): number;
```

Algorithm:
1. Normalize each date to UTC midnight (year, month, day).
2. Dedupe into a `Set` of timestamps.
3. Start at `today = UTC midnight of now`. If `today` not in set, return 0.
4. Counter = 1; walk backward one day at a time while the previous day is in the set; increment.
5. Return counter.

`apps/web/src/lib/stats/accuracy.ts`:

```ts
export function accuracyPercent(correct: number, total: number): number;
// = 0 if total === 0, else Math.round((correct / total) * 100)
```

## UI

### Route

Create `apps/web/src/app/(app)/stats/page.tsx` — server component. Performs three Prisma queries in `Promise.all` (mirrors the route handlers above to keep SSR data-fetching close), passes results to layout.

Why direct Prisma instead of fetching via the new API routes? Server components don't pay network cost when reading from `prisma.*` directly. The API routes exist for client-side and potential external consumers. The page passes the same shapes the API would return.

### Components (`apps/web/src/components/stats/`)

| Component | Type | Purpose |
|---|---|---|
| `KpiCard` | server | Label (small, muted) + value (large, foreground). Optional sub-line. Used 4 times in overview + 3 times in exams. |
| `TopicRadar` | client | Wraps recharts `RadarChart`. Props: `data: { topicName, accuracy }[]`. Uses `accent` token via CSS variable. |
| `TopicAccuracyList` | server | Vertical list below the radar: each topic → name, "X de Y · NN%". |
| `ExamScoreLine` | client | Wraps recharts `LineChart`. Props: `data: { date, score }[]`. X-axis short-date, Y 0–100. |

### Page layout (vertical, `max-w-4xl`)

```
<section class="mx-auto max-w-4xl space-y-8">
  <header><h1>Estatísticas</h1></header>

  <!-- Overview -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <KpiCard label="Respondidas" value={totalAnswered} />
    <KpiCard label="Acerto geral" value={accuracyAll + "%"} />
    <KpiCard label="Streak" value={currentStreak + " dia(s)"} />
    <KpiCard label="Esta semana" value={totalAnsweredWeek + " · " + accuracyWeek + "%"} />
  </div>

  <!-- Topic accuracy -->
  <section class="space-y-3">
    <h2>Acurácia por matéria</h2>
    {byTopic.length === 0 ? <EmptyState /> : (
      <>
        <TopicRadar data={byTopic} />
        <TopicAccuracyList items={byTopic} />
      </>
    )}
  </section>

  <!-- Exams -->
  <section class="space-y-3">
    <h2>Simulados</h2>
    {exams.totalFinished === 0 ? <EmptyState /> : (
      <>
        <div class="grid grid-cols-3 gap-3">
          <KpiCard label="Finalizados" value={exams.totalFinished} />
          <KpiCard label="Média" value={exams.avgScore + "%"} />
          <KpiCard label="Melhor" value={exams.bestScore + "%"} />
        </div>
        <ExamScoreLine data={exams.scores} />
      </>
    )}
  </section>
</section>
```

### Empty states

- **No questions answered** (`totalAnswered === 0`): replace overview cards with a single banner: "Responda algumas questões para começar a ver suas estatísticas" + link to `/questions`. The topic and exam sections render their own empty messages.
- **No exams finished**: "Você ainda não finalizou nenhum simulado." + link to `/exams`.

### Theming

`KpiCard`, list items, headers: semantic Tailwind tokens (`bg-surface`, `text-foreground`, `text-muted`, `border-border`).

Charts: recharts accepts color props directly. To honor the 3 themes (light/dark/code), the chart wrappers (`TopicRadar`, `ExamScoreLine`) read the resolved `--color-accent` (and `--color-border`, `--color-foreground`) from `document.documentElement` via a `useEffect` that listens for theme changes. Pattern mirrors the existing `ThemeSwitcher` (`mounted` flag to avoid SSR mismatch).

### Navigation

Add `<Link href="/stats">Estatísticas</Link>` in `apps/web/src/app/(app)/layout.tsx`, between Flashcards and the conditional Admin link.

### Middleware

Add `/stats/:path*` to the `matcher` in `apps/web/middleware.ts`.

## OpenAPI / Kubb

Register the 3 routes + response schemas (`StatsOverview`, `StatsTopicEntry`, `StatsExams`) in `apps/web/scripts/generate-openapi.ts`. Regenerate Kubb hooks. The hooks are not used by the page (server fetches directly via Prisma) but are useful for completeness and future client-side widgets.

## Dependencies

Add to `apps/web/package.json`:

```json
"recharts": "^3.0.0"
```

(Latest stable at time of writing. Bundle size acceptable; tree-shakes well.)

## Tests

### Unit
- `__tests__/unit/stats-streak.test.ts` — `computeStreak` covering:
  - empty array → 0
  - only today → 1
  - today + yesterday → 2
  - today + 2 days ago (gap) → 1
  - multiple timestamps same day → still counts as 1 day
  - 7 consecutive days → 7
- `__tests__/unit/stats-accuracy.test.ts` — `accuracyPercent` covering:
  - 0/0 → 0
  - 10/10 → 100
  - 7/10 → 70
  - rounding (e.g., 2/3 → 67)

### Integration (real Postgres, prefix `__test_stats_`)
- `stats-overview.test.ts` — auth scope, streak end-to-end (seed answers on specific past days), weekly totals.
- `stats-by-topic.test.ts` — only topics with ≥1 answer, sort by `answered desc`, max 8.
- `stats-exams.test.ts` — only FINISHED with non-null score, scores ASC, KPI math.

All integration tests use `afterAll` cleanup matching the `__test_stats_` prefix on users, exams, answers, topics, questions.

## Risks & open questions

- **Streak timezone:** UTC day boundaries mean a user in Brazil (UTC-3) who answers at 22h local time gets credit for "today UTC" (which is the same day), but a user answering at 22h UTC-3 on Sunday (which is Monday 01h UTC) gets credit for Monday. Acceptable for MVP; user can re-evaluate when timezone becomes a feature.
- **Topic radar with <3 topics:** Radar charts visually break below 3 points (degenerates to a line/triangle). The list view below handles this gracefully. If `byTopic.length < 3`, hide the radar and show only the list.
- **Recharts SSR:** recharts renders nothing on the server (uses `window` for measuring). Wrappers are marked `"use client"`; server passes data, client renders.
- **Score storage:** `Exam.score` is `Float?` 0–1. API multiplies by 100 and rounds for display consistency. Original is preserved.

## Out of scope (future iterations)

- Flashcard stats (depends on `FlashcardReview` log).
- Period comparisons (week-over-week deltas).
- Drill-down from chart elements.
- Time-range toggle.
- Subject-based radar.
- Export to PDF (covered by roadmap step 10).
- Push notifications when streak about to break.
