# Step 3 — Question Bank Seeding (Design)

**Date:** 2026-04-11
**Status:** Approved
**Owner:** HealthQuest Dev

## 1. Goal

Populate the dev database with enough realistic medical-exam questions to unblock Step 4 (Questions API + Kubb codegen) and Step 5 (Question Bank frontend). The seed must:

- Be **idempotent** — re-running `pnpm seed` never duplicates rows and never destroys `AnswerHistory` or `ExamQuestion`.
- Be **extensible** — adding more questions later (from VUNESP/FGV/FCC, ENARE, Revalida, or any other source) is "drop a CSV in `sources/` and re-run", with no TypeScript edit.
- Honor the project's TDD rule and pt-BR content rule.

This step ships **15 starter questions**, all authored by HealthQuest, weighted toward **Enfermagem** (the largest concurso market for VUNESP/FGV/FCC). Future bulk imports from the real banks plug into the same pipeline by adding files under `prisma/seed/sources/`.

## 2. Non-goals

- A PDF extractor for VUNESP/FGV/FCC prova booklets — that's a separate tool and a separate scope.
- Image attachments on questions.
- A tagging system beyond `Subject` + `Institution`.
- Localization (everything is pt-BR).
- Bulk faker-style generation.
- 50+ questions in this slice — 15 high-quality authored questions are enough to exercise filtering, the answer flow, and exam generation in Steps 4 and 5. The "50+" in the architecture spec becomes the long-term target as real bank data is imported.

## 3. Sourcing reality

The user named several preferred sources (VUNESP, FGV, FCC, ENARE, Revalida, Hugging Face, Kaggle). I cannot fetch from any of those in this session — they're behind organization websites that gate downloads, or require account login. Step 3 ships authored content marked unambiguously as such (`institution.name = "HealthQuest"`, `externalId` prefix `authored-`), and provides a CSV ingest pipeline so the user can drop real bank questions later without touching code.

## 4. Schema change

Add one field to `Question` in `packages/db/prisma/schema.prisma`:

```prisma
externalId String? @unique
```

- **Nullable** so future user-created questions don't need one.
- **Unique** so the seed runner can `upsert({ where: { externalId } })` safely.
- Migration: `pnpm --filter @healthquest/db prisma migrate dev --name add_question_externalid` against the dev Postgres. The current DB has zero questions, so the migration is non-destructive.

## 5. Architecture

### 5.1 File layout

```
packages/db/
├── prisma/
│   ├── schema.prisma                      # + externalId field
│   ├── seed.ts                            # entry point
│   └── seed/
│       ├── taxonomies.ts                  # SUBJECTS + INSTITUTIONS constants
│       ├── csv-row.schema.ts              # Zod schema for one CSV row
│       ├── ingest.ts                      # parseCsv() + upsertQuestion()
│       └── sources/
│           ├── README.md                  # how to add a new source file
│           └── healthquest-authored.csv   # the 15 starter questions
└── __tests__/
    └── seed.test.ts                       # TDD integration tests
```

### 5.2 Seed runner flow (`prisma/seed.ts`)

1. **Connect** via the existing `@healthquest/db` Prisma client.
2. **Upsert taxonomies** — for each `name` in `SUBJECTS` and `INSTITUTIONS`, `prisma.subject.upsert({ where: { name }, ... })` and same for institution. Returns a `Map<name, id>` for each.
3. **Walk `prisma/seed/sources/*.csv`** in alphabetical order. For each file:
   - `csv-parse` → array of objects
   - Validate every row against the Zod schema; on failure throw with `${file}:${rowNumber} — ${zodMessage}`.
4. **Upsert each question** in a single transaction per row:
   - `prisma.question.upsert({ where: { externalId }, create: {...}, update: {...} })`
   - For the `create` path, nest the 5 `Alternative` rows.
   - For the `update` path, `deleteMany` the existing alternatives for that question and re-create the 5 — alternative IDs are not stable across edits, but `AnswerHistory` is keyed by `alternativeId`. **This is a real concern: see §6 below.**
5. **Disconnect** and report `{ taxonomies, questions }` counts to stdout.

### 5.3 CSV row schema (`csv-row.schema.ts`)

```ts
import { z } from "zod";

export const csvRowSchema = z.object({
  externalId: z.string().min(1),
  institution: z.string().min(1),
  subject: z.string().min(1),
  year: z.string().regex(/^\d{4}$|^$/).transform(v => v === "" ? null : Number(v)),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  statement: z.string().min(10),
  a: z.string().min(1),
  b: z.string().min(1),
  c: z.string().min(1),
  d: z.string().min(1),
  e: z.string().min(1),
  correct: z.enum(["a", "b", "c", "d", "e"]),
  explanation: z.string().min(10),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
```

### 5.4 CSV column contract

```
externalId,institution,subject,year,difficulty,statement,a,b,c,d,e,correct,explanation
```

- Comma-separated, UTF-8, `"`-quoted strings (csv-parse handles escaping).
- `year` may be empty string to mean "not from a real exam" (used by authored content).
- All text in pt-BR.

### 5.5 Taxonomies (constants)

```ts
export const SUBJECTS = [
  "Enfermagem",
  "Nutrição",
  "Psicologia",
  "Saúde Coletiva",
  "Medicina",
] as const;

export const INSTITUTIONS = [
  "HealthQuest",   // authored content
  "VUNESP",
  "FGV",
  "FCC",
  "ENARE",
  "Revalida",
] as const;
```

The runner pre-creates all of these on every run, even if no question references them yet. Adding a new subject/institution is a one-line edit here; the seed runner picks it up automatically.

## 6. AnswerHistory preservation strategy

### Problem

`AnswerHistory.alternativeId` is a foreign key to `Alternative.id`. If the seed runner deletes and re-creates alternatives on every edit, any `AnswerHistory` row pointing at those alternatives gets a dangling FK and the delete will fail (or cascade).

### Decision

The seed runner uses a two-step update for existing questions:

1. **`Alternative.upsert` keyed by `(questionId, position)`** — add a `position` field (`Int`, 0–4) to `Alternative` and a `@@unique([questionId, position])` constraint. The seed runner upserts each alternative by `(questionId, position)`, so alternative IDs are stable across re-runs.
2. Delete-then-recreate is **never** used for alternatives.

This means `AnswerHistory` rows survive a seed re-run as long as the question's `externalId` is unchanged and the alternative count stays at 5.

This adds a second small schema change to §4:

```prisma
model Alternative {
  ...
  position   Int
  @@unique([questionId, position])
}
```

### Trade-off accepted

Editing the **text** of an existing alternative does not invalidate `AnswerHistory.isCorrect`. If a seed edit changes which alternative is correct (rare but possible — typo fix in the answer key), historical "isCorrect" values become incorrect for past attempts. We accept this; the alternative is to soft-delete questions and create new ones, which doubles row count and isn't worth it for v1.

## 7. Wiring

### `packages/db/package.json`

```json
{
  "scripts": {
    "seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "devDependencies": {
    "csv-parse": "^5.x",
    "tsx": "^4.x",
    "zod": "^4.x"
  }
}
```

`zod` is already a transitive dependency via `apps/web` but should be declared explicitly here. Both `prisma db seed` and `pnpm --filter @healthquest/db seed` work after this.

## 8. TDD plan

Integration tests in `packages/db/__tests__/seed.test.ts` against real Docker Postgres (same setup as the existing `client.test.ts`):

| # | Test | What it proves |
|---|---|---|
| 1 | Empty DB → seed → counts | All 5 subjects and 6 institutions present; `Question.count() === 15`; every question has exactly 5 alternatives with exactly one `isCorrect=true` |
| 2 | Idempotent re-run | Run seed twice; row counts unchanged; no duplicate externalIds |
| 3 | Edit-and-rerun preserves IDs | After two runs, the `Question.id` for `authored-enf-001` is the same; `Alternative.id` for `(question, position=0)` is the same |
| 4 | AnswerHistory preserved across re-runs | Insert a fake `AnswerHistory` tied to a question's first alternative; re-run seed; the AnswerHistory still points at the same alternative |
| 5 | Bad CSV row fails loudly | Use a temp source dir with a row missing `correct` or with `correct=z`; runner throws with `${file}:${row} — ${zodMessage}`; DB unchanged |

Tests prefix all temp source-file content with `__test_` externalIds and clean themselves up in `afterEach`.

## 9. Starter content (15 authored questions)

Subject mix: **10 Enfermagem + 2 Nutrição + 2 Psicologia + 1 Saúde Coletiva**.

Enfermagem topics (one question each):
1. SAE — etapas do processo de enfermagem
2. Sinais vitais — pressão arterial, técnica
3. Administração de medicamentos — regra dos 9 certos
4. Biossegurança — EPIs e descarte de perfurocortantes
5. NR-32 — segurança em serviços de saúde
6. Ostomias — cuidados com colostomia
7. Cuidados pós-operatórios imediatos
8. Hemotransfusão — reações transfusionais
9. Parada cardiorrespiratória — sequência de SBV no adulto
10. Curativos e classificação de feridas

Nutrição topics:
11. Dietoterapia em DM2 — contagem de carboidratos
12. Avaliação nutricional — IMC e classificação no adulto

Psicologia topics:
13. CAPS / RAPS — porta de entrada da rede
14. Escuta clínica — sigilo e seus limites éticos

Saúde Coletiva:
15. SUS — princípios doutrinários (universalidade, integralidade, equidade)

All questions: 5 alternatives, one correct, ≥2-sentence Portuguese explanation, difficulty `MEDIUM`, `year=""`, `institution=HealthQuest`, externalIds `authored-enf-001` … `authored-enf-010`, `authored-nut-001` … `authored-nut-002`, `authored-psi-001` … `authored-psi-002`, `authored-sc-001`.

## 10. Verification

1. `pnpm --filter @healthquest/db prisma migrate dev --name add_question_externalid_and_alternative_position` succeeds against Docker Postgres.
2. `pnpm --filter @healthquest/db test` — all `seed.test.ts` tests pass plus existing tests.
3. `pnpm --filter @healthquest/db seed` — produces `{ subjects: 5, institutions: 6, questions: 15 }` on a fresh DB; second run produces the same counts.
4. Spot-check via Prisma Studio (`pnpm --filter @healthquest/db studio`) that one Enfermagem question has its correct alternative flagged.
5. Existing `apps/web` tests still green (no regression in auth or db tests).

## 11. Out of scope (deferred to later steps)

- VUNESP/FGV/FCC PDF extractor tool
- A loader UI for non-CLI seeding
- Question images
- Question reviewer/approval workflow
- More than 15 questions (will arrive via CSV imports as the user provides them)
