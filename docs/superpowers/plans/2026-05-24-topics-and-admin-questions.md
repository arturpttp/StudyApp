# Topics + Admin Question Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Topic` entity (matéria) with M:N to `Question`, make `Question.subject` optional, add topic-based filtering to questions and exam generation (any/all), and an admin-only page to create questions with on-the-fly topic creation.

**Architecture:** Prisma adds `Topic` model + implicit M:N join with `Question`; `Question.subjectId` becomes nullable. Session callback exposes `role`. New `requireAdmin` helper gates the admin route. One new public endpoint (`GET /topics`), two extended endpoints (questions list, exams generate), one new admin endpoint (`POST /admin/questions`). UI adds a reusable topic multi-select with any/all toggle and an admin-only question form.

**Tech Stack:** Next.js 16.2.3 App Router, Prisma 7.7, Auth.js v5 (JWT), Zod + `@asteasolutions/zod-to-openapi`, Kubb + TanStack Query, Tailwind v4, Vitest + real Postgres.

**Reference files (read before starting):**
- Spec: `docs/superpowers/specs/2026-05-24-topics-and-admin-questions-design.md`
- Project rules: `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/web/src/components/CLAUDE.md`, `apps/web/src/lib/auth/CLAUDE.md`
- Existing patterns:
  - Subjects route: `apps/web/src/app/api/v1/subjects/route.ts`
  - Subjects integration test: `apps/web/__tests__/integration/subjects-api.test.ts`
  - Questions list route: `apps/web/src/app/api/v1/questions/route.ts`
  - Questions list test: `apps/web/__tests__/integration/questions-list.test.ts`
  - Exams generate route + test: `apps/web/src/app/api/v1/exams/generate/route.ts`, `apps/web/__tests__/integration/exams-generate.test.ts`
  - requireAuth: `apps/web/src/lib/api/require-auth.ts`
  - Session callback: `apps/web/src/lib/auth/config.ts`
  - Seed entry / ingest: `packages/db/prisma/seed.ts`, `packages/db/prisma/seed/ingest.ts`, `packages/db/prisma/seed/csv-row.schema.ts`, `packages/db/prisma/seed/taxonomies.ts`
  - CSV sample: `packages/db/prisma/seed/sources/healthquest-authored.csv`
  - FilterSidebar: `apps/web/src/components/questions/FilterSidebar.tsx`
  - NewExamForm: `apps/web/src/components/exams/NewExamForm.tsx`
  - Button / Input / Select: `apps/web/src/components/ui/`

---

## File Structure

**Schema / data:**
- Modify: `packages/db/prisma/schema.prisma` (add `Topic`, make `Question.subjectId` optional, add M:N relation)
- Modify: `packages/db/prisma/seed/taxonomies.ts` (add `TOPICS` constant)
- Modify: `packages/db/prisma/seed/csv-row.schema.ts` (add `topics` column)
- Modify: `packages/db/prisma/seed/ingest.ts` (upsert topics, link M:N)
- Modify: `packages/db/prisma/seed.ts` (build topicMap, pass to upsertQuestion)
- Modify: `packages/db/prisma/seed/sources/healthquest-authored.csv` (add topics column to every row)
- Create: `packages/db/scripts/reset.ts` (wipe + reseed script)
- Modify: `packages/db/package.json` (add `db:reset` script)

**Auth:**
- Modify: `apps/web/src/lib/auth/config.ts` (put `role` on token + session)
- Modify: `apps/web/src/lib/auth/types.d.ts` *(create if absent)* — augment `session.user` and `JWT` types
- Create: `apps/web/src/lib/api/require-admin.ts`
- Create: `apps/web/__tests__/unit/require-admin.test.ts`

**Zod schemas:**
- Modify: `apps/web/src/lib/api/schemas/questions.ts` (add topic params)
- Modify: `apps/web/src/lib/api/schemas/exams.ts` (add topic body fields on generate)
- Create: `apps/web/src/lib/api/schemas/admin-questions.ts`
- Modify: `apps/web/__tests__/unit/question-schemas.test.ts` (new cases)
- Modify: `apps/web/__tests__/unit/exam-schemas.test.ts` (new cases)
- Create: `apps/web/__tests__/unit/admin-question-schemas.test.ts`

**Route handlers:**
- Create: `apps/web/src/app/api/v1/topics/route.ts`
- Create: `apps/web/__tests__/integration/topics-api.test.ts`
- Modify: `apps/web/src/app/api/v1/questions/route.ts` (apply topic filter)
- Modify: `apps/web/__tests__/integration/questions-list.test.ts` (topic cases)
- Modify: `apps/web/src/app/api/v1/exams/generate/route.ts` (apply topic filter)
- Modify: `apps/web/__tests__/integration/exams-generate.test.ts` (topic cases)
- Create: `apps/web/src/app/api/v1/admin/questions/route.ts`
- Create: `apps/web/__tests__/integration/admin-questions-create.test.ts`

**OpenAPI + middleware:**
- Modify: `apps/web/scripts/generate-openapi.ts` (register `/topics`, extend questions + exams, add admin route + schemas)
- Modify: `apps/web/middleware.ts` (add `/admin/:path*`)

**UI:**
- Create: `apps/web/src/components/ui/TopicMultiSelect.tsx` (reusable: multi-select chips + any/all toggle, no inline creation)
- Create: `apps/web/src/components/admin/TopicCombobox.tsx` (admin-only: search + create on-the-fly)
- Modify: `apps/web/src/components/questions/FilterSidebar.tsx`
- Modify: `apps/web/src/components/questions/QuestionCard.tsx` (topic chips)
- Modify: `apps/web/src/app/(app)/questions/[id]/page.tsx` (topic chips on detail header)
- Modify: `apps/web/src/components/exams/NewExamForm.tsx`
- Create: `apps/web/src/app/(app)/admin/layout.tsx` (defense-in-depth role check)
- Create: `apps/web/src/app/(app)/admin/questions/new/page.tsx`
- Create: `apps/web/src/components/admin/NewQuestionForm.tsx` (client form)
- Modify: `apps/web/src/app/(app)/layout.tsx` (conditional admin link)

---

## Commands Cheat Sheet

Run from repo root unless noted:

- Push schema: `pnpm --filter @healthquest/db db:push`
- Regenerate Prisma client: `pnpm --filter @healthquest/db generate`
- Reset DB + reseed: `pnpm --filter @healthquest/db db:reset`
- Regenerate OpenAPI + Kubb hooks: `pnpm --filter @healthquest/web generate:api`
- Run all tests: `pnpm --filter @healthquest/web test`
- Run a single test file: `pnpm --filter @healthquest/web test path/to/file.test.ts`
- Type check: `pnpm --filter @healthquest/web exec tsc --noEmit`
- Dev server: `pnpm --filter @healthquest/web dev`

---

## Task 1: Prisma schema — Topic + optional subject

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Update `Question` and add `Topic`**

In `packages/db/prisma/schema.prisma`, modify the `Question` model and append a new `Topic` model:

```prisma
model Question {
  id            String          @id @default(cuid())
  externalId    String?         @unique
  statement     String
  explanation   String?
  difficulty    Difficulty
  status        Status          @default(ACTIVE)
  year          Int?
  subject       Subject?        @relation(fields: [subjectId], references: [id])
  subjectId     String?
  institution   Institution     @relation(fields: [institutionId], references: [id])
  institutionId String
  alternatives  Alternative[]
  answers       AnswerHistory[]
  examQuestions ExamQuestion[]
  topics        Topic[]
}

model Topic {
  id        String     @id @default(cuid())
  name      String     @unique
  questions Question[]
}
```

Only the changes from the existing model are:
- `subject` becomes optional (`Subject?`)
- `subjectId` becomes optional (`String?`)
- `topics Topic[]` added (Prisma manages the implicit `_QuestionToTopic` join)

- [ ] **Step 2: Push schema and regenerate client**

```bash
pnpm --filter @healthquest/db db:push
pnpm --filter @healthquest/db generate
```

Expected: `db:push` reports adding `Topic` and `_QuestionToTopic`, and altering `Question.subjectId` to nullable. Generate completes without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add Topic model and make Question.subjectId optional"
```

---

## Task 2: Seed taxonomies — add TOPICS

**Files:**
- Modify: `packages/db/prisma/seed/taxonomies.ts`

- [ ] **Step 1: Append TOPICS list**

Append to `packages/db/prisma/seed/taxonomies.ts`:

```ts
export const TOPICS = [
  "Anatomia",
  "Bioquímica",
  "Cardiologia",
  "Endocrinologia",
  "Ética",
  "Farmacologia",
  "Fisiologia",
  "Ginecologia",
  "Infectologia",
  "Microbiologia",
  "Neurologia",
  "Nutrição Clínica",
  "Obstetrícia",
  "Pediatria",
  "Pneumologia",
  "Psicopatologia",
  "Saúde Mental",
  "Saúde Pública",
  "Semiologia",
  "Sistema Único de Saúde",
] as const;

export type TopicName = (typeof TOPICS)[number];
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/prisma/seed/taxonomies.ts
git commit -m "feat(db): add TOPICS taxonomy"
```

---

## Task 3: CSV schema accepts topics column

**Files:**
- Modify: `packages/db/prisma/seed/csv-row.schema.ts`

- [ ] **Step 1: Add `topics` field**

Replace the entire schema in `packages/db/prisma/seed/csv-row.schema.ts`:

```ts
import { z } from "zod";

export const csvRowSchema = z.object({
  externalId: z.string().min(1),
  institution: z.string().min(1),
  subject: z.string().min(1),
  year: z
    .string()
    .regex(/^\d{4}$|^$/)
    .transform((v) => (v === "" ? null : Number(v))),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  statement: z.string().min(10),
  a: z.string().min(1),
  b: z.string().min(1),
  c: z.string().min(1),
  d: z.string().min(1),
  e: z.string().min(1),
  correct: z.enum(["a", "b", "c", "d", "e"]),
  explanation: z.string().min(10),
  topics: z
    .string()
    .min(1, "Pelo menos uma matéria é obrigatória.")
    .transform((v) =>
      v
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    )
    .refine((arr) => arr.length >= 1, {
      message: "Pelo menos uma matéria é obrigatória.",
    }),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
```

Topics column is semicolon-separated (commas conflict with statement text).

- [ ] **Step 2: Commit**

```bash
git add packages/db/prisma/seed/csv-row.schema.ts
git commit -m "feat(db): require topics column in seed CSV"
```

---

## Task 4: ingest links topics on upsert

**Files:**
- Modify: `packages/db/prisma/seed/ingest.ts`

- [ ] **Step 1: Update `upsertQuestion` to accept `topicMap` and link topics**

Replace the entire `upsertQuestion` function (keep `parseCsv` and `POSITION_MAP` as they are). The new signature accepts `topicMap` and connects topics on both update and create paths:

```ts
export async function upsertQuestion(
  prisma: PrismaClient,
  row: CsvRow,
  subjectMap: Map<string, string>,
  institutionMap: Map<string, string>,
  topicMap: Map<string, string>,
): Promise<void> {
  const subjectId = subjectMap.get(row.subject);
  if (!subjectId) {
    throw new Error(`Unknown subject: "${row.subject}"`);
  }
  const institutionId = institutionMap.get(row.institution);
  if (!institutionId) {
    throw new Error(`Unknown institution: "${row.institution}"`);
  }

  const topicIds = row.topics.map((name) => {
    const id = topicMap.get(name);
    if (!id) throw new Error(`Unknown topic: "${name}"`);
    return id;
  });

  const alternatives = (["a", "b", "c", "d", "e"] as const).map((letter) => ({
    text: row[letter],
    isCorrect: row.correct === letter,
    position: POSITION_MAP[letter],
  }));

  const existing = await prisma.question.findUnique({
    where: { externalId: row.externalId },
  });

  if (existing) {
    await prisma.question.update({
      where: { externalId: row.externalId },
      data: {
        statement: row.statement,
        explanation: row.explanation,
        difficulty: row.difficulty,
        year: row.year,
        subjectId,
        institutionId,
        topics: {
          set: topicIds.map((id) => ({ id })),
        },
      },
    });

    for (const alt of alternatives) {
      await prisma.alternative.upsert({
        where: {
          questionId_position: {
            questionId: existing.id,
            position: alt.position,
          },
        },
        create: {
          questionId: existing.id,
          text: alt.text,
          isCorrect: alt.isCorrect,
          position: alt.position,
        },
        update: {
          text: alt.text,
          isCorrect: alt.isCorrect,
        },
      });
    }
  } else {
    await prisma.question.create({
      data: {
        externalId: row.externalId,
        statement: row.statement,
        explanation: row.explanation,
        difficulty: row.difficulty,
        year: row.year,
        subjectId,
        institutionId,
        topics: {
          connect: topicIds.map((id) => ({ id })),
        },
        alternatives: {
          create: alternatives,
        },
      },
    });
  }
}
```

The `set` operator on update replaces the topic set entirely so re-seeding stays consistent.

- [ ] **Step 2: Commit**

```bash
git add packages/db/prisma/seed/ingest.ts
git commit -m "feat(db): upsert and connect topics during seed ingest"
```

---

## Task 5: Seed entry builds topicMap

**Files:**
- Modify: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Build topicMap and pass it**

In `packages/db/prisma/seed.ts`:

1. Update the import line:
   ```ts
   import { SUBJECTS, INSTITUTIONS, TOPICS } from "./seed/taxonomies.js";
   ```
2. Add `topics: number` to the `SeedResult` interface.
3. Inside `seed()`, after the `institutionMap` loop, before the file loop, add:
   ```ts
   const topicMap = new Map<string, string>();
   for (const name of TOPICS) {
     const record = await prisma.topic.upsert({
       where: { name },
       create: { name },
       update: {},
     });
     topicMap.set(name, record.id);
   }
   ```
4. Update the `upsertQuestion` call to pass `topicMap`:
   ```ts
   await upsertQuestion(prisma, row, subjectMap, institutionMap, topicMap);
   ```
5. Add `topics: topicMap.size` to the returned `result` object.

- [ ] **Step 2: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(db): seed Topic table from taxonomy"
```

---

## Task 6: Update CSV source with topics column

**Files:**
- Modify: `packages/db/prisma/seed/sources/healthquest-authored.csv`

- [ ] **Step 1: Add `topics` column and populate every row**

Open `packages/db/prisma/seed/sources/healthquest-authored.csv`. Append `,topics` to the header. Append a semicolon-separated topic list to every existing data row.

Use the following mapping by domain (assign 1–3 topics each based on the question's content):

- Enfermagem rows (`authored-enf-*`): `Semiologia`, `Saúde Pública`, `Farmacologia` as primary defaults — pick what fits.
- Nutrição rows (`authored-nutr-*`): `Nutrição Clínica`, `Bioquímica`.
- Psicologia rows (`authored-psi-*`): `Psicopatologia`, `Saúde Mental`.
- Saúde Coletiva rows (`authored-sc-*`): `Saúde Pública`, `Sistema Único de Saúde`, `Ética`.
- Medicina rows (`authored-med-*`): match clinical area (`Cardiologia`, `Pediatria`, `Neurologia`, etc.) plus `Semiologia` if applicable.

If you're unsure about a row, use `Saúde Pública` as a safe default for any course. Rows must have at least one topic; semicolon-separate multiples (`Cardiologia;Farmacologia`).

- [ ] **Step 2: Verify the CSV parses**

```bash
pnpm --filter @healthquest/db exec tsx -e "import {parseCsv} from './prisma/seed/ingest.ts'; console.log(parseCsv('./prisma/seed/sources/healthquest-authored.csv').length, 'rows')"
```

Expected: prints `15 rows` (or whatever the row count is) and exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/seed/sources/healthquest-authored.csv
git commit -m "feat(db): add topics column to seed CSV"
```

---

## Task 7: db:reset script

**Files:**
- Create: `packages/db/scripts/reset.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Write the reset script**

Create `packages/db/scripts/reset.ts`:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seed } from "../prisma/seed.js";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Wiping question-related data...");
    await prisma.examQuestion.deleteMany({});
    await prisma.exam.deleteMany({});
    await prisma.answerHistory.deleteMany({});
    await prisma.alternative.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.topic.deleteMany({});
    console.log("Wipe complete. Reseeding...");
  } finally {
    await prisma.$disconnect();
  }

  await seed();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
```

Subjects and institutions are preserved (they're stable), users untouched.

- [ ] **Step 2: Add `db:reset` script to package.json**

In `packages/db/package.json` under `"scripts"`, add:

```json
"db:reset": "tsx scripts/reset.ts"
```

- [ ] **Step 3: Run the reset**

```bash
pnpm --filter @healthquest/db db:reset
```

Expected: wipes question-related tables, reseeds, prints `Seed complete: { subjects: 5, institutions: 6, questions: <n>, topics: 20 }`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/scripts/reset.ts packages/db/package.json
git commit -m "feat(db): add db:reset script for wipe + reseed"
```

---

## Task 8: Auth — put `role` on session

**Files:**
- Modify: `apps/web/src/lib/auth/config.ts`
- Create: `apps/web/src/lib/auth/types.d.ts`

- [ ] **Step 1: Update session callback**

In `apps/web/src/lib/auth/config.ts`, replace the `callbacks` block:

```ts
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      token.role = dbUser?.role ?? "STUDENT";
    }
    return token;
  },
  session({ session, token }) {
    if (token.id) session.user.id = token.id as string;
    if (token.role) session.user.role = token.role as "ADMIN" | "STUDENT";
    return session;
  },
},
```

This reads `role` from the DB at login (JWT issuance), then mirrors onto the session.

- [ ] **Step 2: Augment NextAuth types**

Create `apps/web/src/lib/auth/types.d.ts`:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "STUDENT";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADMIN" | "STUDENT";
  }
}
```

- [ ] **Step 3: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no new errors. (Pre-existing `tsconfig.json(5,5)` config error is unrelated.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth/config.ts apps/web/src/lib/auth/types.d.ts
git commit -m "feat(auth): expose user role on session and JWT"
```

---

## Task 9: requireAdmin helper — failing test

**Files:**
- Create: `apps/web/__tests__/unit/require-admin.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/__tests__/unit/require-admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

import { requireAdmin } from "@/lib/api/require-admin";

beforeEach(() => {
  authMock.mockReset();
});

describe("requireAdmin", () => {
  it("returns 401 when no session", async () => {
    authMock.mockResolvedValue(null);
    const { session, errorResponse } = await requireAdmin();
    expect(session).toBeNull();
    expect(errorResponse?.status).toBe(401);
  });

  it("returns 403 when role is STUDENT", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "STUDENT" },
    });
    const { session, errorResponse } = await requireAdmin();
    expect(session).toBeNull();
    expect(errorResponse?.status).toBe(403);
  });

  it("returns the session when role is ADMIN", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const { session, errorResponse } = await requireAdmin();
    expect(errorResponse).toBeNull();
    expect(session?.user.role).toBe("ADMIN");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter @healthquest/web test __tests__/unit/require-admin.test.ts
```

Expected: FAILS with "Cannot find module '@/lib/api/require-admin'".

---

## Task 10: requireAdmin helper — implementation

**Files:**
- Create: `apps/web/src/lib/api/require-admin.ts`

- [ ] **Step 1: Implement the helper**

Create `apps/web/src/lib/api/require-admin.ts`:

```ts
import { auth } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth>>>;

type AdminResult =
  | { session: Session; errorResponse: null }
  | { session: null; errorResponse: Response };

export async function requireAdmin(): Promise<AdminResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      errorResponse: Response.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      errorResponse: Response.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 },
      ),
    };
  }

  return { session, errorResponse: null };
}
```

- [ ] **Step 2: Re-run the test**

```bash
pnpm --filter @healthquest/web test __tests__/unit/require-admin.test.ts
```

Expected: PASSES (3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/require-admin.ts apps/web/__tests__/unit/require-admin.test.ts
git commit -m "feat(api): add requireAdmin helper with 401/403 paths"
```

---

## Task 11: Zod schemas — topics on questions & exams

**Files:**
- Modify: `apps/web/src/lib/api/schemas/questions.ts`
- Modify: `apps/web/src/lib/api/schemas/exams.ts`

- [ ] **Step 1: Extend `questionsQuerySchema`**

Replace the contents of `apps/web/src/lib/api/schemas/questions.ts` with:

```ts
import { z } from "zod";

const topicIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  });

export const questionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  subjectId: z.string().optional(),
  institutionId: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  year: z.coerce.number().int().optional(),
  unanswered: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  topicIds: topicIdsSchema,
  topicMatchMode: z.enum(["any", "all"]).optional().default("any"),
});

export type QuestionsQuery = z.infer<typeof questionsQuerySchema>;

export const randomQuerySchema = z.object({
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

export type RandomQuery = z.infer<typeof randomQuerySchema>;

export const answerBodySchema = z.object({
  alternativeId: z.string().min(1, "alternativeId é obrigatório."),
  responseTime: z.number().int().min(0).optional().default(0),
});

export type AnswerBody = z.infer<typeof answerBodySchema>;
```

The `topicIdsSchema` union accepts either a single string or an array — the route handler will hand it `searchParams.getAll("topicIds")` (always array).

- [ ] **Step 2: Extend `generateExamBodySchema`**

In `apps/web/src/lib/api/schemas/exams.ts`, find the `generateExamBodySchema` (or equivalently named) and add the two fields:

```ts
topicIds: z.array(z.string()).optional().default([]),
topicMatchMode: z.enum(["any", "all"]).optional().default("any"),
```

Keep all existing fields. Export the inferred type as before.

- [ ] **Step 3: Add unit test cases for questions schema**

In `apps/web/__tests__/unit/question-schemas.test.ts`, append:

```ts
describe("questionsQuerySchema — topics", () => {
  it("defaults topicIds to [] and topicMatchMode to 'any'", () => {
    const parsed = questionsQuerySchema.parse({});
    expect(parsed.topicIds).toEqual([]);
    expect(parsed.topicMatchMode).toBe("any");
  });

  it("accepts a single topicId as string", () => {
    const parsed = questionsQuerySchema.parse({ topicIds: "t1" });
    expect(parsed.topicIds).toEqual(["t1"]);
  });

  it("accepts multiple topicIds as array", () => {
    const parsed = questionsQuerySchema.parse({ topicIds: ["t1", "t2"] });
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
  });

  it("rejects invalid topicMatchMode", () => {
    const result = questionsQuerySchema.safeParse({ topicMatchMode: "both" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Add unit test cases for exam-generate schema**

In `apps/web/__tests__/unit/exam-schemas.test.ts`, append (using the schema's actual exported name):

```ts
describe("generateExamBodySchema — topics", () => {
  it("defaults topicIds to [] and topicMatchMode to 'any'", () => {
    const parsed = generateExamBodySchema.parse({ count: 5 });
    expect(parsed.topicIds).toEqual([]);
    expect(parsed.topicMatchMode).toBe("any");
  });

  it("accepts topicIds and topicMatchMode", () => {
    const parsed = generateExamBodySchema.parse({
      count: 5,
      topicIds: ["t1", "t2"],
      topicMatchMode: "all",
    });
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
    expect(parsed.topicMatchMode).toBe("all");
  });
});
```

If the schema is exported under a different name (e.g., `examGenerateBodySchema`), use that. Confirm via `grep "export const.*generate" apps/web/src/lib/api/schemas/exams.ts`.

- [ ] **Step 5: Run unit tests**

```bash
pnpm --filter @healthquest/web test __tests__/unit/question-schemas.test.ts __tests__/unit/exam-schemas.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/schemas/questions.ts apps/web/src/lib/api/schemas/exams.ts apps/web/__tests__/unit/question-schemas.test.ts apps/web/__tests__/unit/exam-schemas.test.ts
git commit -m "feat(api): add topic filters to questions and exam-generate schemas"
```

---

## Task 12: Admin question schema — unit tests first

**Files:**
- Create: `apps/web/__tests__/unit/admin-question-schemas.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/__tests__/unit/admin-question-schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createAdminQuestionBodySchema } from "@/lib/api/schemas/admin-questions";

const validBody = {
  statement: "Qual é a capital do Brasil?",
  difficulty: "EASY" as const,
  institutionId: "inst1",
  topicIds: ["t1"],
  newTopicNames: [],
  alternatives: [
    { text: "Brasília", isCorrect: true, position: 0 },
    { text: "Rio de Janeiro", isCorrect: false, position: 1 },
    { text: "São Paulo", isCorrect: false, position: 2 },
    { text: "Salvador", isCorrect: false, position: 3 },
  ],
};

describe("createAdminQuestionBodySchema", () => {
  it("accepts a valid body", () => {
    const result = createAdminQuestionBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("rejects when both topicIds and newTopicNames are empty", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      topicIds: [],
      newTopicNames: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts when only newTopicNames provided", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      topicIds: [],
      newTopicNames: ["Nova Matéria"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when no alternative is correct", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: validBody.alternatives.map((a) => ({
        ...a,
        isCorrect: false,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects when more than one alternative is correct", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [
        { text: "A", isCorrect: true, position: 0 },
        { text: "B", isCorrect: true, position: 1 },
        { text: "C", isCorrect: false, position: 2 },
        { text: "D", isCorrect: false, position: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicated alternative positions", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [
        { text: "A", isCorrect: true, position: 0 },
        { text: "B", isCorrect: false, position: 0 },
        { text: "C", isCorrect: false, position: 2 },
        { text: "D", isCorrect: false, position: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 alternatives", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [{ text: "A", isCorrect: true, position: 0 }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm --filter @healthquest/web test __tests__/unit/admin-question-schemas.test.ts
```

Expected: FAILS with module not found.

---

## Task 13: Admin question schema — implementation

**Files:**
- Create: `apps/web/src/lib/api/schemas/admin-questions.ts`

- [ ] **Step 1: Implement schema**

Create `apps/web/src/lib/api/schemas/admin-questions.ts`:

```ts
import { z } from "zod";

const alternativeSchema = z.object({
  text: z.string().min(1, "Texto obrigatório."),
  isCorrect: z.boolean(),
  position: z.number().int().min(0),
});

export const createAdminQuestionBodySchema = z
  .object({
    statement: z.string().min(10, "Enunciado muito curto."),
    explanation: z.string().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    year: z.number().int().min(1900).max(2100).optional(),
    subjectId: z.string().optional(),
    institutionId: z.string().min(1, "Instituição obrigatória."),
    topicIds: z.array(z.string()).default([]),
    newTopicNames: z.array(z.string().min(1)).default([]),
    alternatives: z.array(alternativeSchema).min(2).max(6),
  })
  .refine((data) => data.topicIds.length + data.newTopicNames.length >= 1, {
    message: "Pelo menos uma matéria é obrigatória.",
    path: ["topicIds"],
  })
  .refine(
    (data) => data.alternatives.filter((a) => a.isCorrect).length === 1,
    {
      message: "Exatamente uma alternativa deve estar marcada como correta.",
      path: ["alternatives"],
    },
  )
  .refine(
    (data) =>
      new Set(data.alternatives.map((a) => a.position)).size ===
      data.alternatives.length,
    { message: "Posições duplicadas.", path: ["alternatives"] },
  );

export type CreateAdminQuestionBody = z.infer<
  typeof createAdminQuestionBodySchema
>;
```

- [ ] **Step 2: Re-run tests**

```bash
pnpm --filter @healthquest/web test __tests__/unit/admin-question-schemas.test.ts
```

Expected: PASSES (7 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/schemas/admin-questions.ts apps/web/__tests__/unit/admin-question-schemas.test.ts
git commit -m "feat(api): add createAdminQuestionBodySchema with refinements"
```

---

## Task 14: GET /api/v1/topics — failing test

**Files:**
- Create: `apps/web/__tests__/integration/topics-api.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/__tests__/integration/topics-api.test.ts`:

```ts
import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_topics_user", role: "STUDENT", name: "T", email: "t@t.com" },
  }),
}));

import { GET } from "@/app/api/v1/topics/route";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/topics", () => {
  it("returns all topics sorted by name", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const names = body.map((t: { name: string }) => t.name);
    const sorted = [...names].sort((a: string, b: string) =>
      a.localeCompare(b, "pt-BR"),
    );
    expect(names).toEqual(sorted);
  });

  it("returns only id and name for each topic", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body[0])).toEqual(["id", "name"]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/integration/topics-api.test.ts
```

Expected: FAILS with module not found.

---

## Task 15: GET /api/v1/topics — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/topics/route.ts`

- [ ] **Step 1: Implement route**

Create `apps/web/src/app/api/v1/topics/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

export async function GET(): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const topics = await prisma.topic.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Response.json(topics);
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/topics-api.test.ts
```

Expected: PASSES (2 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/topics/route.ts apps/web/__tests__/integration/topics-api.test.ts
git commit -m "feat(api): add GET /api/v1/topics"
```

---

## Task 16: GET /api/v1/questions — topic filter test cases

**Files:**
- Modify: `apps/web/__tests__/integration/questions-list.test.ts`

- [ ] **Step 1: Add topic-filter test cases**

Read the existing test file to follow its setup/teardown pattern. Append new cases inside the existing `describe("GET /api/v1/questions", ...)` block. Each case must seed its own data with `__test_` prefixes and clean up in an `afterEach` or inline `try/finally`.

Add these cases (adapt to the file's existing helpers):

```ts
it("filters by a single topic via topicIds=any", async () => {
  const topicA = await prisma.topic.create({
    data: { name: "__test_topic_A" },
  });
  const topicB = await prisma.topic.create({
    data: { name: "__test_topic_B" },
  });

  // create one question with topic A, one with topic B
  // (use existing test helpers if available; otherwise create inline with
  //  Institution, Alternatives, etc.)

  const req = new Request(
    `http://test/api/v1/questions?topicIds=${topicA.id}&topicMatchMode=any`,
  );
  const res = await GET(req);
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.data.every((q: { topics: { id: string }[] }) =>
    q.topics.some((t) => t.id === topicA.id),
  )).toBe(true);
  // negative: ensure none have ONLY topicB
});

it("filters by multiple topics with mode=any (OR)", async () => {
  // similar setup; assert results include questions linked to either topic
});

it("filters by multiple topics with mode=all (AND)", async () => {
  // create a question linked to BOTH topicA and topicB
  // create one linked to only topicA
  // request topicIds=[A,B]&mode=all
  // assert only the both-linked question is returned
});

it("returns topics array on each question", async () => {
  const req = new Request(`http://test/api/v1/questions`);
  const res = await GET(req);
  const body = await res.json();
  if (body.data.length > 0) {
    expect(body.data[0]).toHaveProperty("topics");
    expect(Array.isArray(body.data[0].topics)).toBe(true);
  }
});
```

You'll need to construct full `Question` rows (Question + Alternative + topics connect). If the test file already has a helper, use it; if not, inline it. Always prefix names with `__test_` for cleanup.

- [ ] **Step 2: Run — expect failures**

```bash
pnpm --filter @healthquest/web test __tests__/integration/questions-list.test.ts
```

Expected: new tests FAIL (either no `topics` field on response, or filtering doesn't apply).

---

## Task 17: GET /api/v1/questions — implement topic filter

**Files:**
- Modify: `apps/web/src/app/api/v1/questions/route.ts`

- [ ] **Step 1: Read topicIds via getAll, build where clause, include topics**

Replace the route handler body of `apps/web/src/app/api/v1/questions/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { questionsQuerySchema } from "@/lib/api/schemas/questions";

export async function GET(req: Request): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const topicIds = url.searchParams.getAll("topicIds");
  const rawParams: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "topicIds") continue;
    rawParams[key] = value;
  }
  if (topicIds.length > 0) rawParams.topicIds = topicIds;

  const parsed = questionsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const {
    page,
    limit,
    subjectId,
    institutionId,
    difficulty,
    year,
    unanswered,
    topicIds: ids,
    topicMatchMode,
  } = parsed.data;

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (subjectId) where.subjectId = subjectId;
  if (institutionId) where.institutionId = institutionId;
  if (difficulty) where.difficulty = difficulty;
  if (year) where.year = year;
  if (unanswered) where.answers = { none: { userId: session.user.id } };

  if (ids.length > 0) {
    if (topicMatchMode === "all") {
      where.AND = ids.map((id) => ({ topics: { some: { id } } }));
    } else {
      where.topics = { some: { id: { in: ids } } };
    }
  }

  const [data, total] = await Promise.all([
    prisma.question.findMany({
      where,
      select: {
        id: true,
        statement: true,
        difficulty: true,
        year: true,
        subject: { select: { id: true, name: true } },
        institution: { select: { id: true, name: true } },
        topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        alternatives: {
          select: { id: true, text: true, position: true },
          orderBy: { position: "asc" },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: "asc" },
    }),
    prisma.question.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/questions-list.test.ts
```

Expected: all pass (including new topic cases).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/questions/route.ts apps/web/__tests__/integration/questions-list.test.ts
git commit -m "feat(api): filter questions by topicIds with any/all match"
```

---

## Task 18: GET /api/v1/questions/[id] — include topics

**Files:**
- Modify: `apps/web/src/app/api/v1/questions/[id]/route.ts`

- [ ] **Step 1: Add `topics` to the select**

In `apps/web/src/app/api/v1/questions/[id]/route.ts`, find the `prisma.question.findUnique` (or `findFirst`) call and add into its `select`:

```ts
topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
```

If a test exists for this route, update it to assert `topics` is present. If not, skip — the integration test in Task 16 covers list-level shape.

- [ ] **Step 2: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/questions/[id]/route.ts
git commit -m "feat(api): include topics on question detail"
```

---

## Task 19: POST /api/v1/exams/generate — topic filter test cases

**Files:**
- Modify: `apps/web/__tests__/integration/exams-generate.test.ts`

- [ ] **Step 1: Add new test cases**

Append inside the existing `describe(...)` block, following the file's existing setup pattern:

```ts
it("filters question pool by topicIds (mode=any)", async () => {
  const topicX = await prisma.topic.create({
    data: { name: "__test_examgen_topicX" },
  });
  const topicY = await prisma.topic.create({
    data: { name: "__test_examgen_topicY" },
  });
  // seed: 5 questions linked to topicX, 5 linked to topicY, 5 to neither
  // request: count=5, topicIds=[X], mode=any
  // assert: exam created with 5 questions, all linked to topicX

  // (use the file's existing question-creation helper)
});

it("filters with mode=all returning only intersection", async () => {
  // seed: 5 questions linked to BOTH topicX and topicY
  //       5 questions linked to only topicX
  // request: count=5, topicIds=[X,Y], mode=all
  // assert: 5 returned, all linked to BOTH
});

it("returns 422 when topic filter shrinks pool below count", async () => {
  const topicZ = await prisma.topic.create({
    data: { name: "__test_examgen_topicZ" },
  });
  // seed: 2 questions linked to topicZ
  // request: count=5, topicIds=[Z]
  // assert: 422
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-generate.test.ts
```

Expected: new tests FAIL.

---

## Task 20: POST /api/v1/exams/generate — implement topic filter

**Files:**
- Modify: `apps/web/src/app/api/v1/exams/generate/route.ts`

- [ ] **Step 1: Apply the same any/all where logic to the candidate pool**

In `apps/web/src/app/api/v1/exams/generate/route.ts`, find the section that builds the `where` for selecting candidate questions (likely `const where: Record<string, unknown> = { status: "ACTIVE" }`). After the existing filters (subject, difficulty, etc.) and before the `findMany`, add:

```ts
const { topicIds: ids, topicMatchMode } = parsed.data;
if (ids && ids.length > 0) {
  if (topicMatchMode === "all") {
    where.AND = ids.map((id) => ({ topics: { some: { id } } }));
  } else {
    where.topics = { some: { id: { in: ids } } };
  }
}
```

(Adapt the variable name destructured from `parsed.data` to match the schema field names you used in Task 11.)

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-generate.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/exams/generate/route.ts apps/web/__tests__/integration/exams-generate.test.ts
git commit -m "feat(api): filter exam-generate pool by topicIds (any/all)"
```

---

## Task 21: POST /api/v1/admin/questions — integration test

**Files:**
- Create: `apps/web/__tests__/integration/admin-questions-create.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/__tests__/integration/admin-questions-create.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST } from "@/app/api/v1/admin/questions/route";

const TEST_PREFIX = "__test_admin_q_";
let institutionId = "";
let topicId = "";

beforeEach(async () => {
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: TEST_PREFIX } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: TEST_PREFIX } },
  });
  await prisma.topic.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });

  const inst = await prisma.institution.create({
    data: { name: TEST_PREFIX + "inst" },
  });
  institutionId = inst.id;
  const topic = await prisma.topic.create({
    data: { name: TEST_PREFIX + "topic" },
  });
  topicId = topic.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeReq(body: unknown): Request {
  return new Request("http://test/api/v1/admin/questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = () => ({
  statement: TEST_PREFIX + "Qual é a alternativa correta?",
  explanation: "Porque sim.",
  difficulty: "EASY" as const,
  institutionId,
  topicIds: [topicId],
  newTopicNames: [],
  alternatives: [
    { text: "Alfa", isCorrect: true, position: 0 },
    { text: "Beta", isCorrect: false, position: 1 },
    { text: "Gama", isCorrect: false, position: 2 },
    { text: "Delta", isCorrect: false, position: 3 },
  ],
});

describe("POST /api/v1/admin/questions", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is STUDENT", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "STUDENT" },
    });
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(403);
  });

  it("creates a question and returns 201 with id (ADMIN)", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();

    const created = await prisma.question.findUnique({
      where: { id: body.id },
      include: { topics: true, alternatives: true },
    });
    expect(created?.topics.map((t) => t.id)).toContain(topicId);
    expect(created?.alternatives.length).toBe(4);
    expect(created?.alternatives.find((a) => a.isCorrect)?.text).toBe("Alfa");
  });

  it("creates new topics on-the-fly (case-insensitive dedup)", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const newName = TEST_PREFIX + "Cardiologia Pediátrica";
    const res = await POST(
      makeReq({
        ...baseBody(),
        topicIds: [],
        newTopicNames: [newName, newName.toUpperCase()],
      }),
    );
    expect(res.status).toBe(201);
    const created = await prisma.question.findUnique({
      where: { id: (await res.json()).id },
      include: { topics: true },
    });
    expect(created?.topics.length).toBe(1);
  });

  it("returns 400 when alternatives are invalid", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({
        ...baseBody(),
        alternatives: [
          { text: "A", isCorrect: false, position: 0 },
          { text: "B", isCorrect: false, position: 1 },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no topics provided", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({ ...baseBody(), topicIds: [], newTopicNames: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when institutionId does not exist", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({ ...baseBody(), institutionId: "nonexistent-id" }),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/integration/admin-questions-create.test.ts
```

Expected: FAILS — module not found.

---

## Task 22: POST /api/v1/admin/questions — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/admin/questions/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/admin/questions/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAdmin } from "@/lib/api/require-admin";
import { createAdminQuestionBodySchema } from "@/lib/api/schemas/admin-questions";

export async function POST(req: Request): Promise<Response> {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = createAdminQuestionBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fields[key]) {
        fields[key] = issue.message;
      }
    }
    return Response.json({ error: "Dados inválidos.", fields }, { status: 400 });
  }

  const data = parsed.data;

  const institution = await prisma.institution.findUnique({
    where: { id: data.institutionId },
    select: { id: true },
  });
  if (!institution) {
    return Response.json(
      { error: "Instituição não encontrada." },
      { status: 404 },
    );
  }

  if (data.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
      select: { id: true },
    });
    if (!subject) {
      return Response.json(
        { error: "Especialidade não encontrada." },
        { status: 404 },
      );
    }
  }

  // Normalize new topic names: trim, lowercase-dedup, dedup against existing
  const trimmedNew = data.newTopicNames.map((n) => n.trim()).filter(Boolean);
  const seen = new Map<string, string>();
  for (const name of trimmedNew) {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  const dedupedNewNames = Array.from(seen.values());

  const result = await prisma.$transaction(async (tx) => {
    const newTopicIds: string[] = [];
    for (const name of dedupedNewNames) {
      const topic = await tx.topic.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      newTopicIds.push(topic.id);
    }

    const allTopicIds = Array.from(new Set([...data.topicIds, ...newTopicIds]));

    const question = await tx.question.create({
      data: {
        statement: data.statement,
        explanation: data.explanation,
        difficulty: data.difficulty,
        year: data.year,
        subjectId: data.subjectId,
        institutionId: data.institutionId,
        topics: { connect: allTopicIds.map((id) => ({ id })) },
        alternatives: {
          create: data.alternatives.map((a) => ({
            text: a.text,
            isCorrect: a.isCorrect,
            position: a.position,
          })),
        },
      },
      select: { id: true },
    });

    return question;
  });

  return Response.json({ id: result.id }, { status: 201 });
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/admin-questions-create.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/admin/questions/route.ts apps/web/__tests__/integration/admin-questions-create.test.ts
git commit -m "feat(api): add POST /api/v1/admin/questions (admin-only create)"
```

---

## Task 23: Register routes in OpenAPI + regen Kubb

**Files:**
- Modify: `apps/web/scripts/generate-openapi.ts`

- [ ] **Step 1: Add Topic schemas and route registrations**

In `apps/web/scripts/generate-openapi.ts`:

1. After the existing `AlternativeSchema` registration, add:
   ```ts
   const TopicSchema = registry.register(
     "Topic",
     z.object({ id: z.string(), name: z.string() }),
   );
   ```
2. Find the `QuestionSchema.register` block and add `topics: z.array(TopicSchema)` and change `subject: SubjectSchema` to `subject: SubjectSchema.nullable()`.
3. Before the `// --- Generate ---` section, add:

   ```ts
   // --- Route: GET /api/v1/topics ---
   registry.registerPath({
     method: "get",
     path: "/api/v1/topics",
     summary: "Listar matérias",
     responses: {
       200: {
         description: "Lista de matérias",
         content: { "application/json": { schema: z.array(TopicSchema) } },
       },
       401: {
         description: "Não autenticado",
         content: { "application/json": { schema: ErrorSchema } },
       },
     },
   });
   ```
4. Find the existing `GET /api/v1/questions` registration. Add to its `request.query` object:
   ```ts
   topicIds: z.array(z.string()).optional(),
   topicMatchMode: z.enum(["any", "all"]).optional(),
   ```
5. Find the existing `POST /api/v1/exams/generate` registration. Add to its body schema:
   ```ts
   topicIds: z.array(z.string()).optional(),
   topicMatchMode: z.enum(["any", "all"]).optional(),
   ```
6. After the exams routes block, add:

   ```ts
   // --- Route: POST /api/v1/admin/questions ---
   registry.registerPath({
     method: "post",
     path: "/api/v1/admin/questions",
     summary: "Cadastrar pergunta (admin)",
     request: {
       body: {
         content: {
           "application/json": {
             schema: z.object({
               statement: z.string().min(10),
               explanation: z.string().optional(),
               difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
               year: z.number().int().optional(),
               subjectId: z.string().optional(),
               institutionId: z.string(),
               topicIds: z.array(z.string()),
               newTopicNames: z.array(z.string()),
               alternatives: z.array(
                 z.object({
                   text: z.string(),
                   isCorrect: z.boolean(),
                   position: z.number().int(),
                 }),
               ),
             }),
           },
         },
       },
     },
     responses: {
       201: {
         description: "Pergunta criada",
         content: { "application/json": { schema: z.object({ id: z.string() }) } },
       },
       400: {
         description: "Dados inválidos",
         content: { "application/json": { schema: ErrorSchema } },
       },
       401: {
         description: "Não autenticado",
         content: { "application/json": { schema: ErrorSchema } },
       },
       403: {
         description: "Acesso restrito",
         content: { "application/json": { schema: ErrorSchema } },
       },
       404: {
         description: "Recurso não encontrado",
         content: { "application/json": { schema: ErrorSchema } },
       },
     },
   });
   ```

- [ ] **Step 2: Regenerate OpenAPI + Kubb hooks**

```bash
pnpm --filter @healthquest/web generate:api
```

Expected: writes new files in `apps/web/src/lib/api/generated/` including `useGetApiV1Topics`, `usePostApiV1AdminQuestions`, updated `useGetApiV1Questions` and `usePostApiV1ExamsGenerate` with the new params.

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/generate-openapi.ts apps/web/src/lib/api/generated apps/web/openapi.json
git commit -m "feat(api): register Topic, admin route, and topic filters in OpenAPI"
```

---

## Task 24: Middleware — protect /admin

**Files:**
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Add /admin to matcher**

Replace the `config` export in `apps/web/middleware.ts`:

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/questions/:path*",
    "/exams/:path*",
    "/admin/:path*",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): protect /admin routes via middleware matcher"
```

---

## Task 25: TopicMultiSelect (reusable filter component)

**Files:**
- Create: `apps/web/src/components/ui/TopicMultiSelect.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/ui/TopicMultiSelect.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/TopicMultiSelect.tsx
git commit -m "feat(web): add TopicMultiSelect reusable filter component"
```

---

## Task 26: FilterSidebar — wire up topic filter

**Files:**
- Modify: `apps/web/src/components/questions/FilterSidebar.tsx`

- [ ] **Step 1: Add Topic state to the filter shape and pass through nuqs**

Read `apps/web/src/components/questions/FilterSidebar.tsx` to find the existing `filters` interface and `onFilterChange` prop. Extend the filter shape with:

```ts
topicIds: string[];
topicMatchMode: "any" | "all";
```

Then:
1. Import the hook and component:
   ```ts
   import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
   import { TopicMultiSelect } from "@/components/ui/TopicMultiSelect";
   ```
2. Fetch topics inside the component:
   ```ts
   const { data: topics } = useGetApiV1Topics();
   ```
3. Render `<TopicMultiSelect>` after the "Especialidade" section and before "Dificuldade":
   ```tsx
   <div className="mb-3">
     <TopicMultiSelect
       topics={topics ?? []}
       selectedIds={filters.topicIds}
       matchMode={filters.topicMatchMode}
       onToggle={(id) => {
         const next = filters.topicIds.includes(id)
           ? filters.topicIds.filter((x) => x !== id)
           : [...filters.topicIds, id];
         onFilterChange("topicIds", next);
       }}
       onMatchModeChange={(mode) => onFilterChange("topicMatchMode", mode)}
     />
   </div>
   ```
4. Update the parent `QuestionBrowser.tsx` (or wherever nuqs state is owned) to declare the two new params:
   ```ts
   topicIds: parseAsArrayOf(parseAsString).withDefault([]),
   topicMatchMode: parseAsStringEnum(["any", "all"]).withDefault("any"),
   ```
   And pass `topicIds` and `topicMatchMode` to the questions hook. The Kubb-generated `useGetApiV1Questions` should accept both via its params object after Task 23's regen.

- [ ] **Step 2: Type check + dev sanity**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
pnpm --filter @healthquest/web dev
```

Visit `/questions` (logged in). Confirm the new Matérias filter appears, selecting topics narrows the list, the `Combinar` toggle is shown only with 2+ selected, and URL params update.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/questions/FilterSidebar.tsx apps/web/src/components/questions/QuestionBrowser.tsx
git commit -m "feat(web): add topic filter (any/all) to questions sidebar"
```

---

## Task 27: NewExamForm — add Matérias multi-select

**Files:**
- Modify: `apps/web/src/components/exams/NewExamForm.tsx`

- [ ] **Step 1: Wire topics into the form**

In `apps/web/src/components/exams/NewExamForm.tsx`:

1. Import:
   ```ts
   import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
   import { TopicMultiSelect } from "@/components/ui/TopicMultiSelect";
   ```
2. Add state:
   ```ts
   const { data: topics } = useGetApiV1Topics();
   const [topicIds, setTopicIds] = useState<string[]>([]);
   const [topicMatchMode, setTopicMatchMode] = useState<"any" | "all">("any");
   ```
3. Render `<TopicMultiSelect>` inside the grid, between Especialidade and Quantidade:
   ```tsx
   <div className="md:col-span-2">
     <TopicMultiSelect
       topics={topics ?? []}
       selectedIds={topicIds}
       matchMode={topicMatchMode}
       onToggle={(id) =>
         setTopicIds((prev) =>
           prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
         )
       }
       onMatchModeChange={setTopicMatchMode}
     />
   </div>
   ```
4. In `handleSubmit`, extend the mutation payload:
   ```ts
   mutation.mutate(
     {
       data: {
         subjectId: subjectId || undefined,
         difficulty: difficulty || undefined,
         count,
         timeLimit: timed ? timeLimit : null,
         topicIds: topicIds.length > 0 ? topicIds : undefined,
         topicMatchMode: topicIds.length > 1 ? topicMatchMode : undefined,
       },
     },
     // existing handlers
   );
   ```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/NewExamForm.tsx
git commit -m "feat(web): add topic filter to NewExamForm with any/all toggle"
```

---

## Task 28: Topic chips on QuestionCard + detail header

**Files:**
- Modify: `apps/web/src/components/questions/QuestionCard.tsx`
- Modify: `apps/web/src/app/(app)/questions/[id]/page.tsx`

- [ ] **Step 1: Extend `QuestionCard` props and render chips**

Read `apps/web/src/components/questions/QuestionCard.tsx` to find the existing props interface. Add to the `question` shape:

```ts
topics: { id: string; name: string }[];
```

In the JSX, near the difficulty badge, add:

```tsx
{question.topics.length > 0 && (
  <div className="flex flex-wrap gap-1">
    {question.topics.map((t) => (
      <span
        key={t.id}
        className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted"
      >
        {t.name}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 2: Add chips to question detail header**

In `apps/web/src/app/(app)/questions/[id]/page.tsx`, add `topics: { select: { id: true, name: true }, orderBy: { name: "asc" } }` to the existing `question.findUnique` select. Then render the same chip block (copy-paste the JSX from Step 1) near the page header.

- [ ] **Step 3: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/questions/QuestionCard.tsx "apps/web/src/app/(app)/questions/[id]/page.tsx"
git commit -m "feat(web): display topic chips on question card and detail"
```

---

## Task 29: TopicCombobox (admin — search + create on-the-fly)

**Files:**
- Create: `apps/web/src/components/admin/TopicCombobox.tsx`

- [ ] **Step 1: Implement the combobox**

Create `apps/web/src/components/admin/TopicCombobox.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/TopicCombobox.tsx
git commit -m "feat(web): add TopicCombobox for admin question form"
```

---

## Task 30: NewQuestionForm (admin client form)

**Files:**
- Create: `apps/web/src/components/admin/NewQuestionForm.tsx`

- [ ] **Step 1: Implement the form**

Create `apps/web/src/components/admin/NewQuestionForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1AdminQuestions } from "@/lib/api/generated/hooks/usePostApiV1AdminQuestions";
import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TopicCombobox } from "@/components/admin/TopicCombobox";

interface Option {
  id: string;
  name: string;
}

interface NewQuestionFormProps {
  subjects: Option[];
  institutions: Option[];
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const EMPTY_ALT = { text: "", isCorrect: false };

export function NewQuestionForm({ subjects, institutions }: NewQuestionFormProps) {
  const router = useRouter();
  const { data: topics } = useGetApiV1Topics();
  const mutation = usePostApiV1AdminQuestions();

  const [statement, setStatement] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [year, setYear] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string>(
    institutions[0]?.id ?? "",
  );
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [newTopicNames, setNewTopicNames] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState([
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
    { ...EMPTY_ALT },
  ]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  function updateAlt(idx: number, text: string) {
    setAlternatives((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, text } : a)),
    );
  }

  function addAlt() {
    if (alternatives.length < 6) {
      setAlternatives((prev) => [...prev, { ...EMPTY_ALT }]);
    }
  }

  function removeAlt(idx: number) {
    if (alternatives.length <= 2) return;
    setAlternatives((prev) => prev.filter((_, i) => i !== idx));
    if (correctIndex === idx) setCorrectIndex(0);
    else if (correctIndex > idx) setCorrectIndex((c) => c - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    mutation.mutate(
      {
        data: {
          statement,
          explanation: explanation || undefined,
          difficulty,
          year: year ? Number(year) : undefined,
          subjectId: subjectId || undefined,
          institutionId,
          topicIds,
          newTopicNames,
          alternatives: alternatives.map((a, i) => ({
            text: a.text,
            isCorrect: i === correctIndex,
            position: i,
          })),
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/questions/${data.id}`);
        },
        onError: async (err) => {
          const anyErr = err as { response?: Response };
          if (anyErr.response) {
            try {
              const body = await anyErr.response.clone().json();
              setServerError(body.error ?? "Erro ao criar pergunta.");
              return;
            } catch {}
          }
          setServerError("Erro ao criar pergunta.");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <label className="block space-y-1">
        <span className="text-sm text-muted">Enunciado</span>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">Explicação (opcional)</span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Dificuldade</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="EASY">Fácil</option>
            <option value="MEDIUM">Médio</option>
            <option value="HARD">Difícil</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Ano (opcional)</span>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Especialidade (opcional)</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Instituição</span>
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            required
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-sm text-muted">Matérias</span>
        <TopicCombobox
          topics={topics ?? []}
          selectedIds={topicIds}
          newNames={newTopicNames}
          onAddExisting={(id) => setTopicIds((p) => [...p, id])}
          onRemoveExisting={(id) =>
            setTopicIds((p) => p.filter((x) => x !== id))
          }
          onAddNew={(name) => setNewTopicNames((p) => [...p, name])}
          onRemoveNew={(name) =>
            setNewTopicNames((p) => p.filter((x) => x !== name))
          }
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-muted">Alternativas (marque a correta)</span>
        {alternatives.map((alt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === idx}
              onChange={() => setCorrectIndex(idx)}
              className="cursor-pointer"
            />
            <Input
              type="text"
              value={alt.text}
              onChange={(e) => updateAlt(idx, e.target.value)}
              required
              className="flex-1"
            />
            {alternatives.length > 2 && (
              <button
                type="button"
                onClick={() => removeAlt(idx)}
                className="text-xs text-muted hover:text-danger cursor-pointer"
              >
                Remover
              </button>
            )}
          </div>
        ))}
        {alternatives.length < 6 && (
          <button
            type="button"
            onClick={addAlt}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            + Adicionar alternativa
          </button>
        )}
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Criando..." : "Criar pergunta"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/admin/NewQuestionForm.tsx
git commit -m "feat(web): add NewQuestionForm for admin question creation"
```

---

## Task 31: /admin layout + /admin/questions/new page

**Files:**
- Create: `apps/web/src/app/(app)/admin/layout.tsx`
- Create: `apps/web/src/app/(app)/admin/questions/new/page.tsx`

- [ ] **Step 1: Create the admin layout (defense-in-depth)**

Create `apps/web/src/app/(app)/admin/layout.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    notFound();
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Create the page**

Create `apps/web/src/app/(app)/admin/questions/new/page.tsx`:

```tsx
import { prisma } from "@healthquest/db";
import { NewQuestionForm } from "@/components/admin/NewQuestionForm";

export default async function NewAdminQuestionPage() {
  const [subjects, institutions] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Cadastrar pergunta
        </h1>
        <p className="text-sm text-muted">Acesso restrito a administradores.</p>
      </header>
      <NewQuestionForm subjects={subjects} institutions={institutions} />
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/admin/layout.tsx" "apps/web/src/app/(app)/admin/questions/new/page.tsx"
git commit -m "feat(web): add /admin/questions/new page (admin-only)"
```

---

## Task 32: Nav link for admin

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Conditionally render the Admin link**

In `apps/web/src/app/(app)/layout.tsx`, locate the `<nav>` block with `<Link href="/questions">` and `<Link href="/exams">`. Replace the nav element with:

```tsx
<nav className="hidden items-center gap-4 text-sm sm:flex">
  <Link href="/questions" className="text-muted hover:text-foreground transition-colors">
    Banco de Questões
  </Link>
  <Link href="/exams" className="text-muted hover:text-foreground transition-colors">
    Simulados
  </Link>
  {session.user.role === "ADMIN" && (
    <Link
      href="/admin/questions/new"
      className="text-muted hover:text-foreground transition-colors"
    >
      Admin
    </Link>
  )}
</nav>
```

- [ ] **Step 2: Verify in dev**

```bash
pnpm --filter @healthquest/web dev
```

- Logged in as STUDENT → no Admin link visible.
- Promote a user manually: `UPDATE "User" SET role='ADMIN' WHERE email='your@email'` then sign out and back in (JWT must be re-issued).
- After re-login → "Admin" link appears in header.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/layout.tsx"
git commit -m "feat(web): conditional Admin nav link for ADMIN users"
```

---

## Task 33: End-to-end browser smoke test

No automated tests for UI layer — manual.

- [ ] **Step 1: Promote a test user to ADMIN**

```sql
UPDATE "User" SET role='ADMIN' WHERE email='your-test-email';
```

Log out, log back in (JWT refresh).

- [ ] **Step 2: Full admin flow**

1. Visit `/admin/questions/new`. Confirm page renders only for ADMIN (STUDENT account hits 404 via the layout's `notFound`).
2. Fill statement, pick difficulty, pick institution; leave subject empty.
3. In Matérias: type "Cardio" — confirm filter shows existing matches and the "+ Criar matéria 'Cardio'" affordance.
4. Add 2 existing topics + 1 new name; verify chips appear.
5. Fill 4 alternatives, mark one correct; submit.
6. On success: confirm redirect to `/questions/<new-id>`. Detail shows chips for all 3 topics (the new one persisted).

- [ ] **Step 3: Filter & exam flows**

1. Visit `/questions`. Use Matérias filter — confirm OR mode default, list narrows. Add a second topic → toggle "Combinar: Todas" appears; check that switching to "Todas" reduces results. URL params reflect both values.
2. Visit `/exams`. Create a simulado picking Matérias + count=5. Confirm only topic-matching questions appear. Try with an over-restrictive combination (count higher than pool) → confirm 422 error message shows.

- [ ] **Step 4: Theme + auth gate**

- Toggle `light → dark → code` on `/admin/questions/new` and `/questions` (with filter open). No hardcoded colors leak.
- Log in as STUDENT. Confirm `/admin/questions/new` returns 404. Confirm no Admin link in nav.

- [ ] **Step 5: Final commit if any small fix-ups landed**

If smoke testing produced small fixes, commit each individually with focused messages.

---

## Self-Review Notes

After finishing all tasks, verify against the spec:

- [ ] `Topic` model exists; `Question.subjectId` is nullable; M:N relation works (Task 1).
- [ ] Seed re-runnable via `db:reset`; topic column required in CSV; all rows have topics (Tasks 2–7).
- [ ] Session callback exposes `role`; `requireAdmin` returns 401/403/ok (Tasks 8–10).
- [ ] All four spec API changes implemented and integration-tested: GET /topics, GET /questions filter, POST /exams/generate filter, POST /admin/questions (Tasks 14–22).
- [ ] OpenAPI registers everything; Kubb hooks regenerated (Task 23).
- [ ] `/admin/:path*` middleware-protected + layout-protected (Tasks 24, 31).
- [ ] FilterSidebar and NewExamForm both have multi-select + any/all toggle (Tasks 26–27).
- [ ] Question chips rendered on list + detail (Task 28).
- [ ] TopicCombobox supports search + on-the-fly creation (Task 29).
- [ ] Admin form submits successfully and redirects (Task 30).
- [ ] Nav link conditional on `role === "ADMIN"` (Task 32).
- [ ] Smoke test covers admin gate + theming (Task 33).
