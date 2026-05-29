# Topics (matérias) and Admin Question Creation — Design

**Date:** 2026-05-24
**Status:** Approved (pending spec review)

## Summary

Adds a new `Topic` ("matéria") concept distinct from the existing `Subject` ("curso"/Especialidade). Each `Question` gets an optional `Subject` and **must** have one or more `Topic`s (M:N). Question list and exam-generation flows get topic-based filtering with a toggle between any-match and all-match semantics. A new admin-only page lets ADMINs register questions directly from the UI, with on-the-fly topic creation.

## Vocabulary

| Term | Meaning | Granularity | Model |
|---|---|---|---|
| **Curso / Especialidade** | Broad field of study | Coarse (~5 values) | `Subject` (kept as-is) |
| **Matéria** | Specific topic within or across fields | Fine (~20+ values, growing) | `Topic` (new) |

Existing `Subject` semantics and the "Especialidade" UI label are preserved. Only the relation cardinality changes (optional FK instead of required).

## Goals

1. Each question carries one or more `Topic`s.
2. `Question.subject` becomes optional.
3. Users can filter questions and generate exams by topic(s), with explicit any/all matching.
4. Admins can register questions from the UI, with the ability to create new topics inline.

## Non-Goals

- No admin edit/delete of questions (create-only this iteration).
- No admin UI for promoting other users — admin role is set manually via DB.
- No dedicated topic-management page — topics are created on-the-fly from the question form.
- No structural hierarchy between Subject and Topic — Topics are flat/global.

## Data Model

### Schema changes (`packages/db/prisma/schema.prisma`)

```prisma
model Question {
  // ... unchanged fields ...
  subject       Subject?        @relation(fields: [subjectId], references: [id])
  subjectId     String?         // now optional
  topics        Topic[]         // M:N, implicit join table _QuestionToTopic
  // ... unchanged ...
}

model Topic {
  id        String     @id @default(cuid())
  name      String     @unique
  questions Question[]
}
```

- M:N is **implicit** (no fields on the join table). Prisma manages `_QuestionToTopic`.
- `Question.subjectId` becomes nullable. Existing rows keep their FK value.

### Seed (`packages/db/prisma/seed/`)

- Add `TOPICS` to `taxonomies.ts` (~15–20 starter values, e.g. Cardiologia, Pneumologia, Endocrinologia, Pediatria, Neurologia, Anatomia, Farmacologia, Saúde Pública, Ética, Bioquímica, …). Final list TBD by author of the seed change.
- `csv-row.schema.ts` accepts a new column `topics`, semicolon-separated (commas conflict with statement text).
- `ingest.ts` upserts each topic name and links via `topics: { connect: [{ id }, ...] }` in `upsertQuestion`.
- All existing seeded CSV rows must be updated to include at least one topic. Seed must fail loudly if a row has zero topics.

### Data migration

- Reset acceptable: `pnpm --filter @healthquest/db db:push` applies schema; a `pnpm db:reset` script (or manual wipe of `Question`, `Alternative`, `AnswerHistory`, `ExamQuestion`, `Exam`) clears stale rows before re-seeding.
- No production data exists — no formal Prisma migration needed.

## API

### New: `GET /api/v1/topics`

Mirrors `/api/v1/subjects` and `/api/v1/institutions`. Returns `Topic[]` sorted by name. Auth required (same as siblings).

Response shape:
```json
[{ "id": "cmxxx", "name": "Cardiologia" }, ...]
```

### Changed: `GET /api/v1/questions`

New query params:

| Param | Type | Notes |
|---|---|---|
| `topicIds` | repeated string | `?topicIds=a&topicIds=b` |
| `topicMatchMode` | `"any"` \| `"all"` | default `"any"` |

Backend translation:
- `any`: `where: { topics: { some: { id: { in: topicIds } } } }`
- `all`: `where: { AND: topicIds.map((id) => ({ topics: { some: { id } } })) }`

`topicIds` is **additive** to existing filters (subjectId, difficulty, etc.). Empty array → no topic constraint.

### Changed: `POST /api/v1/exams/generate`

New body fields:

| Field | Type | Notes |
|---|---|---|
| `topicIds` | `string[]` | optional |
| `topicMatchMode` | `"any" \| "all"` | default `"any"` |

Same translation logic applied to the candidate pool before sampling.

### New: `POST /api/v1/admin/questions`

Admin-only. Body:

```ts
{
  statement: string,           // min 1
  explanation?: string,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  year?: number,
  subjectId?: string,          // optional FK
  institutionId: string,       // required FK
  topicIds: string[],          // existing topics to link (can be empty if newTopicNames non-empty)
  newTopicNames: string[],     // new topics to create on-the-fly (lowercased, deduped, trimmed)
  alternatives: [              // length 2..6
    { text: string, isCorrect: boolean, position: number }
  ]
}
```

Validation:
- `topicIds.length + newTopicNames.length >= 1`
- Exactly one alternative has `isCorrect: true`
- Positions are unique and contiguous starting at 0

Behavior (single transaction):
1. For each name in `newTopicNames`: `topic.upsert({ where: { name }, create: { name }, update: {} })`.
2. Create `Question` with `topics: { connect: [...all ids...] }` and nested `alternatives.create`.
3. Return `{ id }` with status 201.

Failure modes: 400 (validation), 403 (not admin), 404 (subject/institution not found), 409 (rare race on topic name unique).

### Auth changes

- **Session callback** (`lib/auth/config.ts`): include `role` on token and `session.user`. Update the session type augmentation.
- **`requireAdmin` helper** in `lib/api/require-auth.ts` (or new `require-admin.ts`):
  ```ts
  type AdminResult =
    | { session: { user: { id: string; role: "ADMIN" } }, errorResponse: null }
    | { session: null, errorResponse: Response }
  ```
  Returns 401 if no session, 403 if role !== "ADMIN".

## UI

### `FilterSidebar` (`apps/web/src/components/questions/FilterSidebar.tsx`)

New "Matérias" block, positioned between "Especialidade" and "Dificuldade":

- Multi-select using checkboxes (max ~4 visible, scrollable container).
- Toggle row: `Qualquer` / `Todas` (radio-style).
- nuqs state: `topicIds` (array), `topicMatch` (`"any"` | `"all"`, default `"any"`).
- Empty selection ⇒ omits the params from the URL.

### `NewExamForm` (`apps/web/src/components/exams/NewExamForm.tsx`)

Add a "Matérias" section between "Especialidade" and "Quantidade":

- Same multi-select + toggle as the filter.
- Both `subjectId` and `topicIds` are optional.

### Question display

`QuestionCard` and the question-detail header show topic chips (small pills, `bg-surface text-foreground border-border`). Read-only — no interaction.

### Admin question page

New route: `app/(app)/admin/questions/new/page.tsx`.

Form fields, in order:
1. Statement (textarea, 4 rows min)
2. Explanation (textarea, optional)
3. Row: Difficulty (select), Year (number, optional)
4. Row: Subject (select, optional), Institution (select, required)
5. **Topics** — combobox: type to search existing; if no match, "Criar nova matéria" appears as an option. Selected topics shown as removable chips. Backed by `useGetApiV1Topics` for autocomplete; new names accumulate into a local `newTopicNames` array.
6. **Alternatives** — 4 default rows (admin can add 2 more or remove down to 2). Each row: text input + radio for "correta". `position` is implicit (row index).
7. Submit button (disabled while pending). On success: redirect to the question detail page; on error: inline error banner.

### Navigation gating

- Header link "Admin → Cadastrar pergunta" appears only when `session.user.role === "ADMIN"`.
- `middleware.ts` matcher adds `/admin/:path*`.
- `app/(app)/admin/layout.tsx` (or inline check in the page) does `if (session.user.role !== "ADMIN") notFound()` for defense in depth.

## OpenAPI / Kubb

All new and changed routes registered in `apps/web/scripts/generate-openapi.ts`:

- `GET /api/v1/topics` → returns `Topic[]`
- `GET /api/v1/questions` → added `topicIds`, `topicMatchMode` query params
- `POST /api/v1/exams/generate` → added `topicIds`, `topicMatchMode` body fields
- `POST /api/v1/admin/questions` → full body schema + 201/400/403/404 responses

Regenerate Kubb hooks afterward (`pnpm --filter @healthquest/web generate:api`).

## Tests

### Unit

- `__tests__/unit/question-schemas.test.ts` — add cases for `topicIds`, `topicMatchMode` parsing.
- `__tests__/unit/exam-schemas.test.ts` — add cases for new exam-generate fields.
- New `__tests__/unit/admin-question-schemas.test.ts` — validation of admin-create body (positions unique, exactly one correct, topic count ≥1).

### Integration (real Postgres)

- New `__tests__/integration/topics-api.test.ts` — GET returns sorted topics; auth required.
- `__tests__/integration/questions-list.test.ts` — add any/all topic filter cases.
- `__tests__/integration/exams-generate.test.ts` — add any/all topic filter cases; 422 if pool insufficient after topic filter.
- New `__tests__/integration/admin-questions-create.test.ts` — happy path (with mix of existing and new topics), 403 for STUDENT, 400 for invalid bodies, transactional rollback if alternatives fail.

## Risks & open questions

- **Topic name normalization:** on-the-fly creation should lowercase + trim before uniqueness check, but the canonical stored name keeps original capitalization. (Decision: lowercase comparison via Postgres `citext`? Or app-level normalization?) **Resolution:** app-level — trim + treat duplicates case-insensitively at the admin endpoint; store the first-seen capitalization.
- **Backwards compatibility:** existing client code reads `Question.subject` as required. After schema change it becomes `Subject | null`. Audit needed in `QuestionCard`, `QuestionSolver`, exam-report types — should already render gracefully but worth verifying.
- **Pool exhaustion in exam generation:** with topic filtering added, a "Cardiologia + Pneumologia + EASY" combination might have <5 questions. Continue returning 422 as today.

## Out of scope (future work)

- Bulk import of topics via CSV from the admin UI.
- Admin edit/delete/archive of questions.
- Topic management page (rename, merge, delete unused).
- Per-topic statistics (accuracy, count) on the dashboard.
- Promoting users to admin via UI.
