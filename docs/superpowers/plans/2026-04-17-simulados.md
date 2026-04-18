# Simulados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Simulados flow (create → answer with navigation → finish → report) as specified in `docs/superpowers/specs/2026-04-17-simulados-design.md`.

**Architecture:** Prisma adds two nullable fields (`Exam.timeLimit`, `ExamQuestion.selectedAlternativeId`). Four API routes under `/api/v1/exams/` drive the lifecycle. Two pages (`/exams`, `/exams/[id]`) and nine components under `components/exams/` deliver the UI. Answers persist per-question server-side; at finish, a transaction writes to `AnswerHistory` and computes the score.

**Tech Stack:** Next.js 16.2.3 App Router, Prisma, Zod + `@asteasolutions/zod-to-openapi`, Kubb, TanStack Query v5, Tailwind v4 (`tv` + `twMerge`), Auth.js v5, Vitest with real Postgres.

**Reference files (read before starting):**
- Spec: `docs/superpowers/specs/2026-04-17-simulados-design.md`
- Project rules: `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/web/src/components/CLAUDE.md`
- Existing patterns:
  - Route handler with Zod + auth: `apps/web/src/app/api/v1/questions/[id]/answer/route.ts`
  - Integration test pattern: `apps/web/__tests__/integration/questions-answer.test.ts`
  - Zod schemas: `apps/web/src/lib/api/schemas/questions.ts`
  - OpenAPI registration: `apps/web/scripts/generate-openapi.ts`
  - Button variants: `apps/web/src/components/ui/Button.tsx`
  - QuestionSolver as UI reference: `apps/web/src/components/questions/QuestionSolver.tsx`

---

## File Structure

**New / modified files (grouped by responsibility):**

**Schema:**
- Modify: `packages/db/prisma/schema.prisma` (add `timeLimit`, `selectedAlternativeId`, relation)

**Shared API infra:**
- Create: `apps/web/src/lib/api/schemas/exams.ts` — all Zod schemas for exam endpoints
- Create: `apps/web/src/lib/exams/score.ts` — pure function for score calc

**Route handlers:**
- Create: `apps/web/src/app/api/v1/exams/generate/route.ts`
- Create: `apps/web/src/app/api/v1/exams/[id]/route.ts`
- Create: `apps/web/src/app/api/v1/exams/[id]/questions/[questionId]/route.ts`
- Create: `apps/web/src/app/api/v1/exams/[id]/finish/route.ts`

**OpenAPI / codegen:**
- Modify: `apps/web/scripts/generate-openapi.ts` (register 4 new routes + schemas)

**Tests:**
- Create: `apps/web/__tests__/unit/exam-schemas.test.ts`
- Create: `apps/web/__tests__/unit/exam-score.test.ts`
- Create: `apps/web/__tests__/integration/exams-generate.test.ts`
- Create: `apps/web/__tests__/integration/exams-get.test.ts`
- Create: `apps/web/__tests__/integration/exams-patch-question.test.ts`
- Create: `apps/web/__tests__/integration/exams-finish.test.ts`

**Pages:**
- Create: `apps/web/src/app/(app)/exams/page.tsx`
- Create: `apps/web/src/app/(app)/exams/[id]/page.tsx`
- Modify: `apps/web/middleware.ts` (add `/exams/:path*` to matcher)

**Components (all under `apps/web/src/components/exams/`):**
- `NewExamForm.tsx` (client)
- `ExamCard.tsx` (server)
- `ExamRunner.tsx` (client — orchestrator)
- `ExamTimer.tsx` (client)
- `ExamQuestionPalette.tsx` (client)
- `ExamQuestionPanel.tsx` (client)
- `FinishExamDialog.tsx` (client)
- `ExamReport.tsx` (server)
- `ExamReportItem.tsx` (client — expandable)

**Reused components (modified):**
- `apps/web/src/components/questions/AlternativeRow.tsx` — add `"exam-active"` phase

---

## Commands Cheat Sheet

Run from the repo root unless otherwise stated:

- Push schema changes to dev DB: `pnpm --filter @healthquest/db db:push`
- Regenerate Prisma client: `pnpm --filter @healthquest/db generate`
- Regenerate OpenAPI + Kubb hooks: `pnpm --filter @healthquest/web generate:api`
- Run all tests: `pnpm --filter @healthquest/web test`
- Run a single test file: `pnpm --filter @healthquest/web test path/to/file.test.ts`
- Type check: `pnpm --filter @healthquest/web exec tsc --noEmit`
- Dev server: `pnpm --filter @healthquest/web dev`

---

## Task 1: Prisma schema update

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Update `Exam` model**

In `packages/db/prisma/schema.prisma`, replace the `Exam` model (around line 150) with:

```prisma
model Exam {
  id         String         @id @default(cuid())
  user       User           @relation(fields: [userId], references: [id])
  userId     String
  questions  ExamQuestion[]
  status     ExamStatus     @default(IN_PROGRESS)
  score      Float?
  timeLimit  Int?
  createdAt  DateTime       @default(now())
  finishedAt DateTime?
}
```

- [ ] **Step 2: Update `ExamQuestion` model**

Replace the `ExamQuestion` model with:

```prisma
model ExamQuestion {
  exam                  Exam         @relation(fields: [examId], references: [id], onDelete: Cascade)
  examId                String
  question              Question     @relation(fields: [questionId], references: [id])
  questionId            String
  order                 Int
  selectedAlternativeId String?
  selectedAlternative   Alternative? @relation(fields: [selectedAlternativeId], references: [id])

  @@id([examId, questionId])
}
```

- [ ] **Step 3: Add reverse relation on `Alternative`**

Inside the `Alternative` model, add the reverse relation field:

```prisma
model Alternative {
  id             String          @id @default(cuid())
  text           String
  isCorrect      Boolean
  question       Question        @relation(fields: [questionId], references: [id])
  questionId     String
  answers        AnswerHistory[]
  examSelections ExamQuestion[]
}
```

- [ ] **Step 4: Push schema and regenerate client**

```bash
pnpm --filter @healthquest/db db:push
pnpm --filter @healthquest/db generate
```

Expected: "Your database is now in sync with your Prisma schema." and "Generated Prisma Client".

- [ ] **Step 5: Verify type check passes**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors. (If errors appear referencing `Exam` or `ExamQuestion`, they come from stale generated types — rerun step 4.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add timeLimit to Exam and selectedAlternativeId to ExamQuestion"
```

---

## Task 2: Zod schemas for exams

**Files:**
- Create: `apps/web/src/lib/api/schemas/exams.ts`
- Create: `apps/web/__tests__/unit/exam-schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/unit/exam-schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateExamBodySchema,
  patchExamQuestionBodySchema,
} from "@/lib/api/schemas/exams";

describe("generateExamBodySchema", () => {
  it("accepts minimum valid body", () => {
    const result = generateExamBodySchema.safeParse({ count: 5 });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = generateExamBodySchema.safeParse({
      subjectId: "abc",
      difficulty: "EASY",
      count: 20,
      timeLimit: 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts timeLimit: null as no limit", () => {
    const result = generateExamBodySchema.safeParse({ count: 5, timeLimit: null });
    expect(result.success).toBe(true);
  });

  it("rejects count below 5", () => {
    expect(generateExamBodySchema.safeParse({ count: 4 }).success).toBe(false);
  });

  it("rejects count above 100", () => {
    expect(generateExamBodySchema.safeParse({ count: 101 }).success).toBe(false);
  });

  it("rejects timeLimit below 5", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, timeLimit: 4 }).success,
    ).toBe(false);
  });

  it("rejects timeLimit above 600", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, timeLimit: 601 }).success,
    ).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, difficulty: "EXPERT" }).success,
    ).toBe(false);
  });
});

describe("patchExamQuestionBodySchema", () => {
  it("accepts an alternativeId string", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: "abc" }).success,
    ).toBe(true);
  });

  it("accepts null to clear selection", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: null }).success,
    ).toBe(true);
  });

  it("rejects missing field", () => {
    expect(patchExamQuestionBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: "" }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm --filter @healthquest/web test __tests__/unit/exam-schemas.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the schemas**

Create `apps/web/src/lib/api/schemas/exams.ts`:

```ts
import { z } from "zod";

export const generateExamBodySchema = z.object({
  subjectId: z.string().min(1).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  count: z.number().int().min(5).max(100),
  timeLimit: z.number().int().min(5).max(600).nullable().optional(),
});

export type GenerateExamBody = z.infer<typeof generateExamBodySchema>;

export const patchExamQuestionBodySchema = z.object({
  alternativeId: z.string().min(1).nullable(),
});

export type PatchExamQuestionBody = z.infer<typeof patchExamQuestionBodySchema>;
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @healthquest/web test __tests__/unit/exam-schemas.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/schemas/exams.ts apps/web/__tests__/unit/exam-schemas.test.ts
git commit -m "feat(web): add Zod schemas for exam endpoints"
```

---

## Task 3: Pure score-calculation helper

**Files:**
- Create: `apps/web/src/lib/exams/score.ts`
- Create: `apps/web/__tests__/unit/exam-score.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/unit/exam-score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateExamScore } from "@/lib/exams/score";

describe("calculateExamScore", () => {
  it("returns 1.0 when all answers are correct", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(1);
  });

  it("returns 0.0 when all answers are wrong", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "b1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "b2" },
    ]);
    expect(result).toBe(0);
  });

  it("returns partial score for mixed answers", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "b2" },
      { selectedAlternativeId: "a3", correctAlternativeId: "a3" },
      { selectedAlternativeId: "a4", correctAlternativeId: "b4" },
    ]);
    expect(result).toBe(0.5);
  });

  it("counts null (unanswered) as wrong", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: null, correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(0.5);
  });

  it("returns 0.0 when all unanswered", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: null, correctAlternativeId: "a1" },
      { selectedAlternativeId: null, correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm --filter @healthquest/web test __tests__/unit/exam-score.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/exams/score.ts`:

```ts
export interface ScorableAnswer {
  selectedAlternativeId: string | null;
  correctAlternativeId: string;
}

export function calculateExamScore(answers: ScorableAnswer[]): number {
  if (answers.length === 0) return 0;
  const correct = answers.filter(
    (a) =>
      a.selectedAlternativeId !== null &&
      a.selectedAlternativeId === a.correctAlternativeId,
  ).length;
  return correct / answers.length;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @healthquest/web test __tests__/unit/exam-score.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/exams/score.ts apps/web/__tests__/unit/exam-score.test.ts
git commit -m "feat(web): add pure score calculation helper for exams"
```

---

## Task 4: POST /api/v1/exams/generate — integration test

**Files:**
- Create: `apps/web/__tests__/integration/exams-generate.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/__tests__/integration/exams-generate.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_exgen_user", name: "Test", email: "exgen@test.com" },
  }),
}));

const TEST_USER_ID = "__test_exgen_user";
const TEST_SUBJECT_PREFIX = "__test_exgen_subject";

import { POST } from "@/app/api/v1/exams/generate/route";

let subjectA: string;
let subjectB: string;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_exgen@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test ExGen",
      email: "__test_exgen@test.com",
      password: "hashed",
    },
  });

  const sA = await prisma.subject.create({
    data: { name: `${TEST_SUBJECT_PREFIX}_A` },
  });
  const sB = await prisma.subject.create({
    data: { name: `${TEST_SUBJECT_PREFIX}_B` },
  });
  subjectA = sA.id;
  subjectB = sB.id;

  const institution = await prisma.institution.findFirst();

  // 10 EASY questions in subject A
  for (let i = 0; i < 10; i++) {
    await prisma.question.create({
      data: {
        statement: `__test_exgen A ${i}`,
        explanation: null,
        difficulty: "EASY",
        subjectId: subjectA,
        institutionId: institution!.id,
        alternatives: {
          create: [
            { text: "Right", isCorrect: true, position: 0 },
            { text: "Wrong", isCorrect: false, position: 1 },
          ],
        },
      },
    });
  }

  // 3 HARD questions in subject B
  for (let i = 0; i < 3; i++) {
    await prisma.question.create({
      data: {
        statement: `__test_exgen B ${i}`,
        explanation: null,
        difficulty: "HARD",
        subjectId: subjectB,
        institutionId: institution!.id,
        alternatives: {
          create: [
            { text: "Right", isCorrect: true, position: 0 },
            { text: "Wrong", isCorrect: false, position: 1 },
          ],
        },
      },
    });
  }
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { exam: { userId: TEST_USER_ID } } });
  await prisma.exam.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_exgen" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_exgen" } },
  });
  await prisma.subject.deleteMany({
    where: { name: { startsWith: TEST_SUBJECT_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_exgen" } },
  });
  await prisma.$disconnect();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/exams/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/exams/generate", () => {
  it("creates an exam with the requested count and filters", async () => {
    const res = await POST(makeRequest({ subjectId: subjectA, count: 5, difficulty: "EASY" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe("string");

    const exam = await prisma.exam.findUnique({
      where: { id: body.id },
      include: { questions: { include: { question: true } } },
    });
    expect(exam).toBeTruthy();
    expect(exam!.userId).toBe(TEST_USER_ID);
    expect(exam!.status).toBe("IN_PROGRESS");
    expect(exam!.questions.length).toBe(5);
    for (const q of exam!.questions) {
      expect(q.question.subjectId).toBe(subjectA);
      expect(q.question.difficulty).toBe("EASY");
    }
  });

  it("persists timeLimit when provided", async () => {
    const res = await POST(makeRequest({ count: 5, timeLimit: 30 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    const exam = await prisma.exam.findUnique({ where: { id: body.id } });
    expect(exam!.timeLimit).toBe(30);
  });

  it("leaves timeLimit null when omitted", async () => {
    const res = await POST(makeRequest({ count: 5 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    const exam = await prisma.exam.findUnique({ where: { id: body.id } });
    expect(exam!.timeLimit).toBeNull();
  });

  it("returns 422 when pool has fewer questions than count", async () => {
    const res = await POST(
      makeRequest({ subjectId: subjectB, count: 10, difficulty: "HARD" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 for invalid body (count below minimum)", async () => {
    const res = await POST(makeRequest({ count: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos.");
    expect(body.fields).toBeDefined();
  });

  it("creates sequential order values for ExamQuestion", async () => {
    const res = await POST(makeRequest({ subjectId: subjectA, count: 5 }));
    const body = await res.json();
    const eqs = await prisma.examQuestion.findMany({
      where: { examId: body.id },
      orderBy: { order: "asc" },
    });
    expect(eqs.map((e) => e.order)).toEqual([0, 1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-generate.test.ts
```

Expected: FAIL with "Cannot find module '@/app/api/v1/exams/generate/route'".

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/__tests__/integration/exams-generate.test.ts
git commit -m "test(web): add failing integration test for POST /exams/generate"
```

---

## Task 5: POST /api/v1/exams/generate — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/exams/generate/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/exams/generate/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { generateExamBodySchema } from "@/lib/api/schemas/exams";

export async function POST(req: Request): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
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

  const parsed = generateExamBodySchema.safeParse(body);
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

  const { subjectId, difficulty, count, timeLimit } = parsed.data;

  const candidates = await prisma.question.findMany({
    where: {
      status: "ACTIVE",
      ...(subjectId && { subjectId }),
      ...(difficulty && { difficulty }),
    },
    select: { id: true },
  });

  if (candidates.length < count) {
    return Response.json(
      { error: "Não há questões suficientes para os filtros escolhidos." },
      { status: 422 },
    );
  }

  // Fisher-Yates shuffle, then take first N
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, count);

  const exam = await prisma.exam.create({
    data: {
      userId: session.user.id,
      timeLimit: timeLimit ?? null,
      questions: {
        create: picked.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
    },
    select: { id: true },
  });

  return Response.json({ id: exam.id }, { status: 201 });
}
```

- [ ] **Step 2: Run the test, verify it passes**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-generate.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/exams/generate/route.ts
git commit -m "feat(web): implement POST /api/v1/exams/generate"
```

---

## Task 6: GET /api/v1/exams/[id] — integration test

**Files:**
- Create: `apps/web/__tests__/integration/exams-get.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/__tests__/integration/exams-get.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_exget_user", name: "Test", email: "exget@test.com" },
  }),
}));

const TEST_USER_ID = "__test_exget_user";
const OTHER_USER_ID = "__test_exget_other";

import { GET } from "@/app/api/v1/exams/[id]/route";

let inProgressExamId: string;
let finishedExamId: string;
let otherUsersExamId: string;
let questionId: string;
let correctAltId: string;
let wrongAltId: string;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_exget@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test ExGet",
      email: "__test_exget@test.com",
      password: "hashed",
    },
  });
  await prisma.user.upsert({
    where: { email: "__test_exget_other@test.com" },
    update: {},
    create: {
      id: OTHER_USER_ID,
      name: "Other",
      email: "__test_exget_other@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  const q = await prisma.question.create({
    data: {
      statement: "__test_exget question",
      explanation: "Because reasons.",
      difficulty: "EASY",
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "Right", isCorrect: true, position: 0 },
          { text: "Wrong", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });
  questionId = q.id;
  correctAltId = q.alternatives.find((a) => a.isCorrect)!.id;
  wrongAltId = q.alternatives.find((a) => !a.isCorrect)!.id;

  const inProgress = await prisma.exam.create({
    data: {
      userId: TEST_USER_ID,
      status: "IN_PROGRESS",
      timeLimit: 30,
      questions: {
        create: [{ questionId, order: 0, selectedAlternativeId: wrongAltId }],
      },
    },
  });
  inProgressExamId = inProgress.id;

  const finished = await prisma.exam.create({
    data: {
      userId: TEST_USER_ID,
      status: "FINISHED",
      score: 0,
      finishedAt: new Date(),
      questions: {
        create: [{ questionId, order: 0, selectedAlternativeId: wrongAltId }],
      },
    },
  });
  finishedExamId = finished.id;

  const other = await prisma.exam.create({
    data: {
      userId: OTHER_USER_ID,
      questions: { create: [{ questionId, order: 0 }] },
    },
  });
  otherUsersExamId = other.id;
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({
    where: { exam: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } } },
  });
  await prisma.exam.deleteMany({
    where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
  });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_exget" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_exget" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_exget" } },
  });
  await prisma.$disconnect();
});

describe("GET /api/v1/exams/[id]", () => {
  it("returns IN_PROGRESS shape without gabarito fields", async () => {
    const res = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: inProgressExamId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("IN_PROGRESS");
    expect(body.timeLimit).toBe(30);
    expect(body.questions).toHaveLength(1);
    const q = body.questions[0];
    expect(q.statement).toBeDefined();
    expect(q.alternatives).toBeDefined();
    expect(q.selectedAlternativeId).toBe(wrongAltId);
    expect(q.correctAlternativeId).toBeUndefined();
    expect(q.explanation).toBeUndefined();
    expect(q.isCorrect).toBeUndefined();
    for (const alt of q.alternatives) {
      expect(alt.isCorrect).toBeUndefined();
    }
  });

  it("returns FINISHED shape with gabarito and score", async () => {
    const res = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: finishedExamId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("FINISHED");
    expect(body.score).toBe(0);
    expect(body.finishedAt).toBeDefined();
    const q = body.questions[0];
    expect(q.selectedAlternativeId).toBe(wrongAltId);
    expect(q.correctAlternativeId).toBe(correctAltId);
    expect(q.explanation).toBe("Because reasons.");
    expect(q.isCorrect).toBe(false);
  });

  it("returns 404 when exam does not exist", async () => {
    const res = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "does_not_exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when exam belongs to another user", async () => {
    const res = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ id: otherUsersExamId }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-get.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/__tests__/integration/exams-get.test.ts
git commit -m "test(web): add failing integration test for GET /exams/[id]"
```

---

## Task 7: GET /api/v1/exams/[id] — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/exams/[id]/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/exams/[id]/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      score: true,
      timeLimit: true,
      createdAt: true,
      finishedAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              alternatives: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  text: true,
                  position: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    return Response.json({ error: "Simulado não encontrado." }, { status: 404 });
  }

  const isFinished = exam.status === "FINISHED";

  const questions = exam.questions.map((eq) => {
    const base = {
      questionId: eq.question.id,
      order: eq.order,
      statement: eq.question.statement,
      alternatives: eq.question.alternatives.map((a) => ({
        id: a.id,
        text: a.text,
        position: a.position,
      })),
      selectedAlternativeId: eq.selectedAlternativeId,
    };

    if (!isFinished) return base;

    const correct = eq.question.alternatives.find((a) => a.isCorrect);
    return {
      ...base,
      explanation: eq.question.explanation,
      correctAlternativeId: correct!.id,
      isCorrect:
        eq.selectedAlternativeId !== null &&
        eq.selectedAlternativeId === correct!.id,
    };
  });

  return Response.json({
    id: exam.id,
    status: exam.status,
    timeLimit: exam.timeLimit,
    createdAt: exam.createdAt,
    ...(isFinished && { score: exam.score, finishedAt: exam.finishedAt }),
    questions,
  });
}
```

- [ ] **Step 2: Run the test, verify it passes**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-get.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/exams/[id]/route.ts
git commit -m "feat(web): implement GET /api/v1/exams/[id] with discriminated shape"
```

---

## Task 8: PATCH /api/v1/exams/[id]/questions/[questionId] — integration test

**Files:**
- Create: `apps/web/__tests__/integration/exams-patch-question.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/__tests__/integration/exams-patch-question.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_expq_user", name: "Test", email: "expq@test.com" },
  }),
}));

const TEST_USER_ID = "__test_expq_user";
const OTHER_USER_ID = "__test_expq_other";

import { PATCH } from "@/app/api/v1/exams/[id]/questions/[questionId]/route";

let examId: string;
let finishedExamId: string;
let otherExamId: string;
let questionId: string;
let otherQuestionId: string;
let altA: string;
let altB: string;
let otherAlt: string;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_expq@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test",
      email: "__test_expq@test.com",
      password: "hashed",
    },
  });
  await prisma.user.upsert({
    where: { email: "__test_expq_other@test.com" },
    update: {},
    create: {
      id: OTHER_USER_ID,
      name: "Other",
      email: "__test_expq_other@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  const q1 = await prisma.question.create({
    data: {
      statement: "__test_expq Q1",
      difficulty: "EASY",
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "A", isCorrect: true, position: 0 },
          { text: "B", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });
  questionId = q1.id;
  altA = q1.alternatives.find((a) => a.position === 0)!.id;
  altB = q1.alternatives.find((a) => a.position === 1)!.id;

  const q2 = await prisma.question.create({
    data: {
      statement: "__test_expq Q2",
      difficulty: "EASY",
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "X", isCorrect: true, position: 0 },
          { text: "Y", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });
  otherQuestionId = q2.id;
  otherAlt = q2.alternatives[0].id;

  const active = await prisma.exam.create({
    data: {
      userId: TEST_USER_ID,
      questions: { create: [{ questionId, order: 0 }] },
    },
  });
  examId = active.id;

  const done = await prisma.exam.create({
    data: {
      userId: TEST_USER_ID,
      status: "FINISHED",
      score: 0,
      finishedAt: new Date(),
      questions: { create: [{ questionId, order: 0 }] },
    },
  });
  finishedExamId = done.id;

  const other = await prisma.exam.create({
    data: {
      userId: OTHER_USER_ID,
      questions: { create: [{ questionId, order: 0 }] },
    },
  });
  otherExamId = other.id;
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({
    where: { exam: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } } },
  });
  await prisma.exam.deleteMany({
    where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
  });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_expq" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_expq" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_expq" } },
  });
  await prisma.$disconnect();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/exams/[id]/questions/[questionId]", () => {
  it("saves selectedAlternativeId", async () => {
    const res = await PATCH(makeRequest({ alternativeId: altA }), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    expect(res.status).toBe(204);

    const eq = await prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId, questionId } },
    });
    expect(eq!.selectedAlternativeId).toBe(altA);
  });

  it("updates from one alternative to another", async () => {
    await PATCH(makeRequest({ alternativeId: altA }), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    await PATCH(makeRequest({ alternativeId: altB }), {
      params: Promise.resolve({ id: examId, questionId }),
    });

    const eq = await prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId, questionId } },
    });
    expect(eq!.selectedAlternativeId).toBe(altB);
  });

  it("clears selection with null", async () => {
    await PATCH(makeRequest({ alternativeId: altA }), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    const res = await PATCH(makeRequest({ alternativeId: null }), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    expect(res.status).toBe(204);

    const eq = await prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId, questionId } },
    });
    expect(eq!.selectedAlternativeId).toBeNull();
  });

  it("returns 409 when exam is FINISHED", async () => {
    const res = await PATCH(makeRequest({ alternativeId: altA }), {
      params: Promise.resolve({ id: finishedExamId, questionId }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 400 when alternative does not belong to the question", async () => {
    const res = await PATCH(makeRequest({ alternativeId: otherAlt }), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when exam belongs to another user", async () => {
    const res = await PATCH(makeRequest({ alternativeId: altA }), {
      params: Promise.resolve({ id: otherExamId, questionId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when question is not part of the exam", async () => {
    const res = await PATCH(makeRequest({ alternativeId: otherAlt }), {
      params: Promise.resolve({ id: examId, questionId: otherQuestionId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: examId, questionId }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-patch-question.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/__tests__/integration/exams-patch-question.test.ts
git commit -m "test(web): add failing integration test for PATCH /exams/[id]/questions/[qid]"
```

---

## Task 9: PATCH /api/v1/exams/[id]/questions/[questionId] — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/exams/[id]/questions/[questionId]/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/exams/[id]/questions/[questionId]/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { patchExamQuestionBodySchema } from "@/lib/api/schemas/exams";

type RouteContext = {
  params: Promise<{ id: string; questionId: string }>;
};

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id: examId, questionId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = patchExamQuestionBodySchema.safeParse(body);
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

  const { alternativeId } = parsed.data;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId: session.user.id },
    select: { status: true },
  });
  if (!exam) {
    return Response.json({ error: "Simulado não encontrado." }, { status: 404 });
  }
  if (exam.status === "FINISHED") {
    return Response.json(
      { error: "Simulado já foi finalizado." },
      { status: 409 },
    );
  }

  const examQuestion = await prisma.examQuestion.findUnique({
    where: { examId_questionId: { examId, questionId } },
    select: {
      question: {
        select: { alternatives: { select: { id: true } } },
      },
    },
  });
  if (!examQuestion) {
    return Response.json(
      { error: "Questão não pertence a este simulado." },
      { status: 404 },
    );
  }

  if (alternativeId !== null) {
    const belongs = examQuestion.question.alternatives.some(
      (a) => a.id === alternativeId,
    );
    if (!belongs) {
      return Response.json(
        { error: "Alternativa não pertence a esta questão." },
        { status: 400 },
      );
    }
  }

  await prisma.examQuestion.update({
    where: { examId_questionId: { examId, questionId } },
    data: { selectedAlternativeId: alternativeId },
  });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Run the test, verify it passes**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-patch-question.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/exams/[id]/questions/[questionId]/route.ts
git commit -m "feat(web): implement PATCH /api/v1/exams/[id]/questions/[qid]"
```

---

## Task 10: PATCH /api/v1/exams/[id]/finish — integration test

**Files:**
- Create: `apps/web/__tests__/integration/exams-finish.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/__tests__/integration/exams-finish.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_exfin_user", name: "Test", email: "exfin@test.com" },
  }),
}));

const TEST_USER_ID = "__test_exfin_user";

import { PATCH } from "@/app/api/v1/exams/[id]/finish/route";

let questionIds: string[];
let correctIds: string[];
let wrongIds: string[];

async function makeExam(selections: (string | null)[]) {
  return prisma.exam.create({
    data: {
      userId: TEST_USER_ID,
      questions: {
        create: questionIds.slice(0, selections.length).map((qid, idx) => ({
          questionId: qid,
          order: idx,
          selectedAlternativeId: selections[idx],
        })),
      },
    },
  });
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_exfin@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test",
      email: "__test_exfin@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  questionIds = [];
  correctIds = [];
  wrongIds = [];
  for (let i = 0; i < 4; i++) {
    const q = await prisma.question.create({
      data: {
        statement: `__test_exfin Q${i}`,
        explanation: `Exp ${i}`,
        difficulty: "EASY",
        subjectId: subject!.id,
        institutionId: institution!.id,
        alternatives: {
          create: [
            { text: "Right", isCorrect: true, position: 0 },
            { text: "Wrong", isCorrect: false, position: 1 },
          ],
        },
      },
      include: { alternatives: true },
    });
    questionIds.push(q.id);
    correctIds.push(q.alternatives.find((a) => a.isCorrect)!.id);
    wrongIds.push(q.alternatives.find((a) => !a.isCorrect)!.id);
  }
});

afterEach(async () => {
  await prisma.answerHistory.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.examQuestion.deleteMany({
    where: { exam: { userId: TEST_USER_ID } },
  });
  await prisma.exam.deleteMany({ where: { userId: TEST_USER_ID } });
});

afterAll(async () => {
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_exfin" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_exfin" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_exfin" } },
  });
  await prisma.$disconnect();
});

describe("PATCH /api/v1/exams/[id]/finish", () => {
  it("scores 1.0 when all answers correct", async () => {
    const exam = await makeExam([correctIds[0], correctIds[1], correctIds[2], correctIds[3]]);
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.status).toBe("FINISHED");
  });

  it("scores 0.0 when all answers wrong", async () => {
    const exam = await makeExam([wrongIds[0], wrongIds[1], wrongIds[2], wrongIds[3]]);
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    const body = await res.json();
    expect(body.score).toBe(0);
  });

  it("scores mixed answers correctly", async () => {
    const exam = await makeExam([correctIds[0], wrongIds[1], correctIds[2], wrongIds[3]]);
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    const body = await res.json();
    expect(body.score).toBe(0.5);
  });

  it("counts null selections as wrong", async () => {
    const exam = await makeExam([correctIds[0], null, correctIds[2], null]);
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    const body = await res.json();
    expect(body.score).toBe(0.5);
  });

  it("creates AnswerHistory rows only for answered questions", async () => {
    const exam = await makeExam([correctIds[0], null, wrongIds[2], null]);
    await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });

    const rows = await prisma.answerHistory.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    const byQuestion = Object.fromEntries(rows.map((r) => [r.questionId, r]));
    expect(byQuestion[questionIds[0]].isCorrect).toBe(true);
    expect(byQuestion[questionIds[0]].alternativeId).toBe(correctIds[0]);
    expect(byQuestion[questionIds[2]].isCorrect).toBe(false);
    expect(byQuestion[questionIds[2]].alternativeId).toBe(wrongIds[2]);
  });

  it("marks status FINISHED and sets finishedAt", async () => {
    const exam = await makeExam([correctIds[0]]);
    await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    const updated = await prisma.exam.findUnique({ where: { id: exam.id } });
    expect(updated!.status).toBe("FINISHED");
    expect(updated!.finishedAt).not.toBeNull();
  });

  it("returns 409 when already FINISHED", async () => {
    const exam = await makeExam([correctIds[0]]);
    await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: exam.id }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 when exam does not exist", async () => {
    const res = await PATCH(new Request("http://localhost/", { method: "PATCH" }), {
      params: Promise.resolve({ id: "does_not_exist" }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-finish.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/__tests__/integration/exams-finish.test.ts
git commit -m "test(web): add failing integration test for PATCH /exams/[id]/finish"
```

---

## Task 11: PATCH /api/v1/exams/[id]/finish — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/exams/[id]/finish/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/exams/[id]/finish/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { calculateExamScore } from "@/lib/exams/score";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id: examId } = await ctx.params;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId: session.user.id },
    select: {
      id: true,
      status: true,
      timeLimit: true,
      createdAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
          questionId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              alternatives: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  text: true,
                  position: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    return Response.json({ error: "Simulado não encontrado." }, { status: 404 });
  }
  if (exam.status === "FINISHED") {
    return Response.json(
      { error: "Simulado já foi finalizado." },
      { status: 409 },
    );
  }

  const scoreInputs = exam.questions.map((eq) => {
    const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
    return {
      selectedAlternativeId: eq.selectedAlternativeId,
      correctAlternativeId: correct.id,
    };
  });
  const score = calculateExamScore(scoreInputs);

  const historyRows = exam.questions
    .filter((eq) => eq.selectedAlternativeId !== null)
    .map((eq) => {
      const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
      return {
        userId: session.user.id,
        questionId: eq.questionId,
        alternativeId: eq.selectedAlternativeId!,
        isCorrect: eq.selectedAlternativeId === correct.id,
        responseTime: 0,
      };
    });

  const finishedAt = new Date();

  await prisma.$transaction([
    ...historyRows.map((row) => prisma.answerHistory.create({ data: row })),
    prisma.exam.update({
      where: { id: examId },
      data: { status: "FINISHED", score, finishedAt },
    }),
  ]);

  const questions = exam.questions.map((eq) => {
    const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
    return {
      questionId: eq.question.id,
      order: eq.order,
      statement: eq.question.statement,
      explanation: eq.question.explanation,
      alternatives: eq.question.alternatives.map((a) => ({
        id: a.id,
        text: a.text,
        position: a.position,
      })),
      selectedAlternativeId: eq.selectedAlternativeId,
      correctAlternativeId: correct.id,
      isCorrect:
        eq.selectedAlternativeId !== null &&
        eq.selectedAlternativeId === correct.id,
    };
  });

  return Response.json({
    id: exam.id,
    status: "FINISHED",
    score,
    timeLimit: exam.timeLimit,
    createdAt: exam.createdAt,
    finishedAt,
    questions,
  });
}
```

- [ ] **Step 2: Run the test, verify it passes**

```bash
pnpm --filter @healthquest/web test __tests__/integration/exams-finish.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Run the full test suite**

```bash
pnpm --filter @healthquest/web test
```

Expected: all tests pass. No regression in existing suites.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/v1/exams/[id]/finish/route.ts
git commit -m "feat(web): implement PATCH /api/v1/exams/[id]/finish"
```

---

## Task 12: Register new routes in OpenAPI + regen Kubb

**Files:**
- Modify: `apps/web/scripts/generate-openapi.ts`

- [ ] **Step 1: Add component schemas and the four route registrations**

Open `apps/web/scripts/generate-openapi.ts`. After the existing `// --- Route: POST /api/v1/questions/{id}/answer ---` block and **before** the `// --- Generate ---` section, add:

```ts
// --- Exam schemas ---

const ExamAlternativeSchema = registry.register(
  "ExamAlternative",
  z.object({ id: z.string(), text: z.string(), position: z.number().int() }),
);

const ExamQuestionActiveSchema = registry.register(
  "ExamQuestionActive",
  z.object({
    questionId: z.string(),
    order: z.number().int(),
    statement: z.string(),
    alternatives: z.array(ExamAlternativeSchema),
    selectedAlternativeId: z.string().nullable(),
  }),
);

const ExamQuestionReportSchema = registry.register(
  "ExamQuestionReport",
  z.object({
    questionId: z.string(),
    order: z.number().int(),
    statement: z.string(),
    explanation: z.string().nullable(),
    alternatives: z.array(ExamAlternativeSchema),
    selectedAlternativeId: z.string().nullable(),
    correctAlternativeId: z.string(),
    isCorrect: z.boolean(),
  }),
);

const ExamInProgressSchema = registry.register(
  "ExamInProgress",
  z.object({
    id: z.string(),
    status: z.literal("IN_PROGRESS"),
    timeLimit: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    questions: z.array(ExamQuestionActiveSchema),
  }),
);

const ExamFinishedSchema = registry.register(
  "ExamFinished",
  z.object({
    id: z.string(),
    status: z.literal("FINISHED"),
    score: z.number(),
    timeLimit: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    questions: z.array(ExamQuestionReportSchema),
  }),
);

// --- Route: POST /api/v1/exams/generate ---

registry.registerPath({
  method: "post",
  path: "/api/v1/exams/generate",
  summary: "Gerar simulado",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            subjectId: z.string().optional(),
            difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
            count: z.number().int().min(5).max(100),
            timeLimit: z.number().int().min(5).max(600).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Simulado criado",
      content: {
        "application/json": { schema: z.object({ id: z.string() }) },
      },
    },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    422: {
      description: "Pool insuficiente",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/exams/{id} ---

registry.registerPath({
  method: "get",
  path: "/api/v1/exams/{id}",
  summary: "Buscar simulado (ativo ou finalizado)",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Estado do simulado",
      content: {
        "application/json": {
          schema: z.union([ExamInProgressSchema, ExamFinishedSchema]),
        },
      },
    },
    404: {
      description: "Simulado não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/exams/{id}/questions/{questionId} ---

registry.registerPath({
  method: "patch",
  path: "/api/v1/exams/{id}/questions/{questionId}",
  summary: "Atualizar seleção de alternativa",
  request: {
    params: z.object({ id: z.string(), questionId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            alternativeId: z.string().min(1).nullable(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Seleção salva" },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Simulado já finalizado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/exams/{id}/finish ---

registry.registerPath({
  method: "patch",
  path: "/api/v1/exams/{id}/finish",
  summary: "Finalizar simulado",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Relatório final",
      content: { "application/json": { schema: ExamFinishedSchema } },
    },
    404: {
      description: "Simulado não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Simulado já finalizado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});
```

- [ ] **Step 2: Regenerate OpenAPI + Kubb hooks**

```bash
pnpm --filter @healthquest/web generate:api
```

Expected: creates/updates files under `apps/web/src/lib/api/generated/`. Look for new types (`ExamInProgress`, `ExamFinished`, `PostApiV1ExamsGenerate`, `GetApiV1ExamsId`, `PatchApiV1ExamsIdFinish`, etc.) and corresponding hooks.

- [ ] **Step 3: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/generate-openapi.ts apps/web/src/lib/api/generated apps/web/openapi.json
git commit -m "feat(web): register exam routes in OpenAPI and regenerate hooks"
```

---

## Task 13: Middleware — protect /exams

**Files:**
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Add `/exams/:path*` to the matcher**

Replace the `config` export in `apps/web/middleware.ts` with:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/questions/:path*", "/exams/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): protect /exams routes via middleware matcher"
```

---

## Task 14: `AlternativeRow` — add `"exam-active"` phase

**Files:**
- Modify: `apps/web/src/components/questions/AlternativeRow.tsx`

**Context:** `ExamQuestionPanel` needs to render selectable alternatives without ever revealing the gabarito. The cleanest way is a new phase in the existing state machine — it behaves like `"answering"` but guarantees no reveal and no scissors/elimination affordance (elimination is a banco-only feature).

- [ ] **Step 1: Extend the `phase` prop type**

In `apps/web/src/components/questions/AlternativeRow.tsx`, change the interface:

```ts
interface AlternativeRowProps {
  alternative: { id: string; text: string; position: number };
  letter: string;
  isSelected: boolean;
  isEliminated: boolean;
  phase: "answering" | "submitting" | "revealed" | "exam-active";
  result: PostApiV1QuestionsIdAnswer200 | null;
  onSelect: (id: string) => void;
  onToggleEliminate: (id: string) => void;
}
```

- [ ] **Step 2: Verify existing behavior accommodates the new phase**

Only the type signature changes. Confirm each of these still holds after the update:
- `isRevealed = phase === "revealed" && result !== null` — `"exam-active"` is not `"revealed"`, so `isRevealed` is `false`. No reveal classes applied. ✓
- Scissors slot: `phase === "answering" ? <button/> : <span spacer/>` — `"exam-active"` falls through to the spacer. ✓
- Select button: `disabled={isDisabled || isRevealed}` — `isDisabled` is `phase === "submitting"` only, `isRevealed` is `false`. Button stays selectable. ✓
- `isEliminated` path — `onToggleEliminate` is never called (no scissors button rendered), so elimination cannot happen in exam-active mode. ExamQuestionPanel passes `isEliminated={false}` and `onToggleEliminate={() => {}}`.

No JSX edits needed.

- [ ] **Step 3: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter @healthquest/web test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/questions/AlternativeRow.tsx
git commit -m "feat(web): add exam-active phase to AlternativeRow for simulado use"
```

---

## Task 15: `NewExamForm` component

**Files:**
- Create: `apps/web/src/components/exams/NewExamForm.tsx`

- [ ] **Step 1: Create the form**

Create `apps/web/src/components/exams/NewExamForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1ExamsGenerate } from "@/lib/api/generated/hooks/usePostApiV1ExamsGenerate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Subject {
  id: string;
  name: string;
}

interface NewExamFormProps {
  subjects: Subject[];
}

export function NewExamForm({ subjects }: NewExamFormProps) {
  const router = useRouter();
  const mutation = usePostApiV1ExamsGenerate();

  const [subjectId, setSubjectId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"" | "EASY" | "MEDIUM" | "HARD">("");
  const [count, setCount] = useState<number>(10);
  const [timed, setTimed] = useState(false);
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    mutation.mutate(
      {
        data: {
          subjectId: subjectId || undefined,
          difficulty: difficulty || undefined,
          count,
          timeLimit: timed ? timeLimit : null,
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/exams/${data.id}`);
        },
        onError: async (err) => {
          const anyErr = err as { response?: Response };
          if (anyErr.response) {
            try {
              const body = await anyErr.response.clone().json();
              setServerError(body.error ?? "Erro ao gerar simulado.");
              return;
            } catch {}
          }
          setServerError("Erro ao gerar simulado.");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground">Novo simulado</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Especialidade</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Dificuldade</span>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as typeof difficulty)
            }
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground cursor-pointer"
          >
            <option value="">Qualquer</option>
            <option value="EASY">Fácil</option>
            <option value="MEDIUM">Médio</option>
            <option value="HARD">Difícil</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Quantidade (5–100)</span>
          <Input
            type="number"
            min={5}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={timed}
              onChange={(e) => setTimed(e.target.checked)}
              className="cursor-pointer"
            />
            Com tempo limitado
          </label>
          {timed && (
            <label className="block space-y-1">
              <span className="text-sm text-muted">Minutos (5–600)</span>
              <Input
                type="number"
                min={5}
                max={600}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />
            </label>
          )}
        </div>
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Gerando..." : "Gerar simulado"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors. (If the generated hook path differs — e.g., `usePostApiV1ExamsGenerate` is named slightly differently — adjust the import to match the actual filename in `apps/web/src/lib/api/generated/hooks/`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exams/NewExamForm.tsx
git commit -m "feat(web): add NewExamForm component for exam creation"
```

---

## Task 16: `ExamCard` component

**Files:**
- Create: `apps/web/src/components/exams/ExamCard.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/exams/ExamCard.tsx`:

```tsx
import Link from "next/link";
import { twMerge } from "tailwind-merge";

interface ExamCardProps {
  exam: {
    id: string;
    status: "IN_PROGRESS" | "FINISHED";
    score: number | null;
    createdAt: Date;
    finishedAt: Date | null;
    questionCount: number;
    answeredCount: number;
  };
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ExamCard({ exam }: ExamCardProps) {
  const isActive = exam.status === "IN_PROGRESS";
  const statusLabel = isActive ? "Em andamento" : "Finalizado";
  const statusClasses = isActive
    ? "bg-badge-medium-bg text-badge-medium-text"
    : "bg-badge-easy-bg text-badge-easy-text";

  const actionLabel = isActive ? "Continuar" : "Ver relatório";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={twMerge(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
              statusClasses,
            )}
          >
            {statusLabel}
          </span>
          <span className="text-sm text-foreground">
            Simulado de {exam.questionCount} questões
          </span>
        </div>
        <p className="text-xs text-muted">
          Criado em {formatDate(exam.createdAt)}
          {exam.finishedAt && ` · Finalizado em ${formatDate(exam.finishedAt)}`}
        </p>
        {isActive ? (
          <p className="text-xs text-muted">
            Progresso: {exam.answeredCount} / {exam.questionCount} respondidas
          </p>
        ) : (
          exam.score !== null && (
            <p className="text-xs text-muted">
              Pontuação: {Math.round(exam.score * 100)}%
            </p>
          )
        )}
      </div>
      <Link
        href={`/exams/${exam.id}`}
        className="inline-flex items-center rounded border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-surface cursor-pointer"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/ExamCard.tsx
git commit -m "feat(web): add ExamCard component for exam list"
```

---

## Task 17: `/exams/page.tsx` — exam list page

**Files:**
- Create: `apps/web/src/app/(app)/exams/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(app)/exams/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { NewExamForm } from "@/components/exams/NewExamForm";
import { ExamCard } from "@/components/exams/ExamCard";

export default async function ExamsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [subjects, exams] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.exam.findMany({
      where: { userId: session.user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        score: true,
        createdAt: true,
        finishedAt: true,
        questions: {
          select: { selectedAlternativeId: true },
        },
      },
    }),
  ]);

  const examsForList = exams.map((e) => ({
    id: e.id,
    status: e.status,
    score: e.score,
    createdAt: e.createdAt,
    finishedAt: e.finishedAt,
    questionCount: e.questions.length,
    answeredCount: e.questions.filter((q) => q.selectedAlternativeId !== null).length,
  }));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Simulados</h1>
        <p className="text-sm text-muted">
          Crie um novo simulado ou continue um em andamento.
        </p>
      </header>

      <NewExamForm subjects={subjects} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Meus simulados</h2>
        {examsForList.length === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não tem simulados. Crie o primeiro acima.
          </p>
        ) : (
          <div className="space-y-2">
            {examsForList.map((e) => (
              <ExamCard key={e.id} exam={e} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify dev server renders the page**

```bash
pnpm --filter @healthquest/web dev
```

Visit `http://localhost:3000/exams` (log in first). Confirm the form renders with populated subjects and the empty-state message appears. Create one simulado — should redirect to `/exams/[id]` (which will 404 until Task 22, that's fine).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/exams/page.tsx
git commit -m "feat(web): add /exams list page with form and prior exams"
```

---

## Task 18: `ExamTimer` component

**Files:**
- Create: `apps/web/src/components/exams/ExamTimer.tsx`

- [ ] **Step 1: Create the timer**

Create `apps/web/src/components/exams/ExamTimer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface ExamTimerProps {
  createdAt: string | Date;
  timeLimit: number | null;
  onExpire?: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function ExamTimer({ createdAt, timeLimit, onExpire }: ExamTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startMs = new Date(createdAt).getTime();

  let label: string;
  if (timeLimit === null) {
    const elapsedSeconds = (now - startMs) / 1000;
    label = formatSeconds(elapsedSeconds);
  } else {
    const totalMs = timeLimit * 60 * 1000;
    const remainingSeconds = (startMs + totalMs - now) / 1000;
    if (remainingSeconds <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
    label = formatSeconds(Math.max(0, remainingSeconds));
  }

  return (
    <span className="font-mono text-sm text-muted">{label}</span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/ExamTimer.tsx
git commit -m "feat(web): add ExamTimer (stopwatch + countdown)"
```

---

## Task 19: `ExamQuestionPalette` component

**Files:**
- Create: `apps/web/src/components/exams/ExamQuestionPalette.tsx`

- [ ] **Step 1: Create the palette**

Create `apps/web/src/components/exams/ExamQuestionPalette.tsx`:

```tsx
"use client";

import { twMerge } from "tailwind-merge";

interface ExamQuestionPaletteProps {
  total: number;
  currentIndex: number;
  answered: boolean[];
  onSelect: (index: number) => void;
}

export function ExamQuestionPalette({
  total,
  currentIndex,
  answered,
  onSelect,
}: ExamQuestionPaletteProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answered[i];

        const classes = twMerge(
          "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer",
          isCurrent
            ? "border-accent bg-accent text-primary-foreground"
            : isAnswered
              ? "border-badge-easy-text bg-badge-easy-bg text-badge-easy-text"
              : "border-border bg-surface text-muted hover:border-accent",
        );

        return (
          <button
            key={i}
            type="button"
            aria-label={`Ir para questão ${i + 1}`}
            aria-current={isCurrent || undefined}
            onClick={() => onSelect(i)}
            className={classes}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/ExamQuestionPalette.tsx
git commit -m "feat(web): add ExamQuestionPalette for jumping between questions"
```

---

## Task 20: `ExamQuestionPanel` component

**Files:**
- Create: `apps/web/src/components/exams/ExamQuestionPanel.tsx`

- [ ] **Step 1: Create the panel**

Create `apps/web/src/components/exams/ExamQuestionPanel.tsx`:

```tsx
"use client";

import { AlternativeRow } from "@/components/questions/AlternativeRow";
import { positionToLetter } from "@/lib/question-utils";

interface Alternative {
  id: string;
  text: string;
  position: number;
}

interface ExamQuestionPanelProps {
  statement: string;
  alternatives: Alternative[];
  selectedAlternativeId: string | null;
  onSelect: (alternativeId: string) => void;
}

export function ExamQuestionPanel({
  statement,
  alternatives,
  selectedAlternativeId,
  onSelect,
}: ExamQuestionPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-foreground whitespace-pre-wrap">{statement}</p>
      <div className="space-y-2">
        {alternatives.map((alt) => (
          <AlternativeRow
            key={alt.id}
            alternative={alt}
            letter={positionToLetter(alt.position)}
            isSelected={selectedAlternativeId === alt.id}
            isEliminated={false}
            phase="exam-active"
            result={null}
            onSelect={onSelect}
            onToggleEliminate={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/ExamQuestionPanel.tsx
git commit -m "feat(web): add ExamQuestionPanel for active-exam question view"
```

---

## Task 21: `FinishExamDialog` component

**Files:**
- Create: `apps/web/src/components/exams/FinishExamDialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `apps/web/src/components/exams/FinishExamDialog.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";

interface FinishExamDialogProps {
  open: boolean;
  unansweredCount: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FinishExamDialog({
  open,
  unansweredCount,
  isSubmitting,
  onConfirm,
  onCancel,
}: FinishExamDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md w-full space-y-4 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-foreground">
          Finalizar simulado?
        </h3>
        {unansweredCount > 0 ? (
          <p className="text-sm text-muted">
            Você tem <strong>{unansweredCount}</strong>{" "}
            {unansweredCount === 1 ? "questão sem resposta" : "questões sem resposta"}
            . Elas contarão como erradas. Deseja finalizar mesmo assim?
          </p>
        ) : (
          <p className="text-sm text-muted">
            Todas as questões foram respondidas. Deseja finalizar?
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Finalizando..." : "Finalizar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/exams/FinishExamDialog.tsx
git commit -m "feat(web): add FinishExamDialog confirmation modal"
```

---

## Task 22: `ExamRunner` orchestrator

**Files:**
- Create: `apps/web/src/components/exams/ExamRunner.tsx`

- [ ] **Step 1: Create the runner**

Create `apps/web/src/components/exams/ExamRunner.tsx`:

```tsx
"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePatchApiV1ExamsIdQuestionsQuestionId } from "@/lib/api/generated/hooks/usePatchApiV1ExamsIdQuestionsQuestionId";
import { usePatchApiV1ExamsIdFinish } from "@/lib/api/generated/hooks/usePatchApiV1ExamsIdFinish";
import { Button } from "@/components/ui/Button";
import { ExamTimer } from "./ExamTimer";
import { ExamQuestionPalette } from "./ExamQuestionPalette";
import { ExamQuestionPanel } from "./ExamQuestionPanel";
import { FinishExamDialog } from "./FinishExamDialog";

interface ExamQuestion {
  questionId: string;
  order: number;
  statement: string;
  alternatives: { id: string; text: string; position: number }[];
  selectedAlternativeId: string | null;
}

interface ExamRunnerProps {
  exam: {
    id: string;
    timeLimit: number | null;
    createdAt: string;
    questions: ExamQuestion[];
  };
}

export function ExamRunner({ exam }: ExamRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(exam.questions.map((q) => [q.questionId, q.selectedAlternativeId])),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const patchQuestion = usePatchApiV1ExamsIdQuestionsQuestionId();
  const finishMutation = usePatchApiV1ExamsIdFinish();
  const finishRequestedRef = useRef(false);

  const currentQuestion = exam.questions[currentIndex];
  const answered = useMemo(
    () => exam.questions.map((q) => selections[q.questionId] !== null && selections[q.questionId] !== undefined),
    [exam.questions, selections],
  );
  const unansweredCount = answered.filter((a) => !a).length;

  function handleSelect(alternativeId: string) {
    const questionId = currentQuestion.questionId;
    const previous = selections[questionId];
    const next = previous === alternativeId ? null : alternativeId;

    setSelections((prev) => ({ ...prev, [questionId]: next }));

    patchQuestion.mutate(
      { id: exam.id, questionId, data: { alternativeId: next } },
      {
        onError: () => {
          setSelections((prev) => {
            if (prev[questionId] === next) {
              return { ...prev, [questionId]: previous };
            }
            return prev;
          });
        },
      },
    );
  }

  function requestFinish() {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;
    finishMutation.mutate(
      { id: exam.id },
      {
        onSuccess: () => {
          router.refresh();
        },
        onError: () => {
          finishRequestedRef.current = false;
          router.refresh();
        },
      },
    );
  }

  function handleFinishClick() {
    setDialogOpen(true);
  }

  function handleConfirmFinish() {
    setDialogOpen(false);
    requestFinish();
  }

  function handleTimerExpire() {
    if (finishRequestedRef.current) return;
    requestFinish();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">
          Questão {currentIndex + 1} de {exam.questions.length}
        </div>
        <ExamTimer
          createdAt={exam.createdAt}
          timeLimit={exam.timeLimit}
          onExpire={handleTimerExpire}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <ExamQuestionPanel
          statement={currentQuestion.statement}
          alternatives={currentQuestion.alternatives}
          selectedAlternativeId={selections[currentQuestion.questionId] ?? null}
          onSelect={handleSelect}
        />

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(exam.questions.length - 1, i + 1))
            }
            disabled={currentIndex === exam.questions.length - 1}
          >
            Próxima
          </Button>
        </div>
      </div>

      <ExamQuestionPalette
        total={exam.questions.length}
        currentIndex={currentIndex}
        answered={answered}
        onSelect={setCurrentIndex}
      />

      <Button type="button" onClick={handleFinishClick} disabled={finishMutation.isPending}>
        Finalizar Simulado
      </Button>

      <FinishExamDialog
        open={dialogOpen}
        unansweredCount={unansweredCount}
        isSubmitting={finishMutation.isPending}
        onConfirm={handleConfirmFinish}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors. If a Kubb-generated hook has a slightly different name (e.g., the parameter naming scheme for `[questionId]`), adjust the import path to match.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exams/ExamRunner.tsx
git commit -m "feat(web): add ExamRunner orchestrator for active simulado"
```

---

## Task 23: `ExamReport` + `ExamReportItem` components

**Files:**
- Create: `apps/web/src/components/exams/ExamReport.tsx`
- Create: `apps/web/src/components/exams/ExamReportItem.tsx`

- [ ] **Step 1: Create the report item**

Create `apps/web/src/components/exams/ExamReportItem.tsx`:

```tsx
"use client";

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { AlternativeRow } from "@/components/questions/AlternativeRow";
import { positionToLetter } from "@/lib/question-utils";

interface ExamReportItemProps {
  index: number;
  question: {
    questionId: string;
    statement: string;
    explanation: string | null;
    alternatives: { id: string; text: string; position: number }[];
    selectedAlternativeId: string | null;
    correctAlternativeId: string;
    isCorrect: boolean;
  };
}

export function ExamReportItem({ index, question }: ExamReportItemProps) {
  const [open, setOpen] = useState(false);

  const headerStatusClasses = question.isCorrect
    ? "text-badge-easy-text"
    : "text-badge-hard-text";

  const statusLabel = question.isCorrect
    ? "Correta"
    : question.selectedAlternativeId === null
      ? "Sem resposta"
      : "Incorreta";

  const pseudoResult = {
    isCorrect: question.isCorrect,
    correctAlternativeId: question.correctAlternativeId,
    explanation: question.explanation,
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            Q{index + 1}
          </span>
          <span className={twMerge("text-sm font-semibold", headerStatusClasses)}>
            {statusLabel}
          </span>
        </div>
        <span className="text-xs text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-foreground whitespace-pre-wrap">{question.statement}</p>
          <div className="space-y-2">
            {question.alternatives.map((alt) => (
              <AlternativeRow
                key={alt.id}
                alternative={alt}
                letter={positionToLetter(alt.position)}
                isSelected={question.selectedAlternativeId === alt.id}
                isEliminated={false}
                phase="revealed"
                result={pseudoResult}
                onSelect={() => {}}
                onToggleEliminate={() => {}}
              />
            ))}
          </div>
          {question.explanation && (
            <div className="rounded border border-border bg-background p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the report container**

Create `apps/web/src/components/exams/ExamReport.tsx`:

```tsx
import { ExamReportItem } from "./ExamReportItem";

interface ExamReportProps {
  exam: {
    id: string;
    score: number;
    createdAt: string;
    finishedAt: string;
    questions: {
      questionId: string;
      order: number;
      statement: string;
      explanation: string | null;
      alternatives: { id: string; text: string; position: number }[];
      selectedAlternativeId: string | null;
      correctAlternativeId: string;
      isCorrect: boolean;
    }[];
  };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ExamReport({ exam }: ExamReportProps) {
  const correct = exam.questions.filter((q) => q.isCorrect).length;
  const total = exam.questions.length;
  const percent = Math.round(exam.score * 100);
  const duration = new Date(exam.finishedAt).getTime() - new Date(exam.createdAt).getTime();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Relatório do simulado</h2>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs uppercase text-muted">Acertos</p>
            <p className="text-2xl font-semibold text-foreground">
              {correct} / {total}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Pontuação</p>
            <p className="text-2xl font-semibold text-foreground">{percent}%</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Tempo</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatDuration(duration)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {exam.questions.map((q, i) => (
          <ExamReportItem key={q.questionId} index={i} question={q} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exams/ExamReport.tsx apps/web/src/components/exams/ExamReportItem.tsx
git commit -m "feat(web): add ExamReport and ExamReportItem for finished exams"
```

---

## Task 24: `/exams/[id]/page.tsx` — dispatcher

**Files:**
- Create: `apps/web/src/app/(app)/exams/[id]/page.tsx`

- [ ] **Step 1: Create the dispatcher page**

Create `apps/web/src/app/(app)/exams/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { ExamRunner } from "@/components/exams/ExamRunner";
import { ExamReport } from "@/components/exams/ExamReport";

type PageProps = { params: Promise<{ id: string }> };

export default async function ExamDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      score: true,
      timeLimit: true,
      createdAt: true,
      finishedAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              alternatives: {
                orderBy: { position: "asc" },
                select: { id: true, text: true, position: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const header = (
    <Link
      href="/exams"
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
    >
      &larr; Simulados
    </Link>
  );

  if (exam.status === "IN_PROGRESS") {
    const runnerExam = {
      id: exam.id,
      timeLimit: exam.timeLimit,
      createdAt: exam.createdAt.toISOString(),
      questions: exam.questions.map((eq) => ({
        questionId: eq.question.id,
        order: eq.order,
        statement: eq.question.statement,
        alternatives: eq.question.alternatives.map((a) => ({
          id: a.id,
          text: a.text,
          position: a.position,
        })),
        selectedAlternativeId: eq.selectedAlternativeId,
      })),
    };

    return (
      <section className="mx-auto max-w-3xl space-y-6">
        {header}
        <ExamRunner exam={runnerExam} />
      </section>
    );
  }

  const reportExam = {
    id: exam.id,
    score: exam.score ?? 0,
    createdAt: exam.createdAt.toISOString(),
    finishedAt: (exam.finishedAt ?? exam.createdAt).toISOString(),
    questions: exam.questions.map((eq) => {
      const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
      return {
        questionId: eq.question.id,
        order: eq.order,
        statement: eq.question.statement,
        explanation: eq.question.explanation,
        alternatives: eq.question.alternatives.map((a) => ({
          id: a.id,
          text: a.text,
          position: a.position,
        })),
        selectedAlternativeId: eq.selectedAlternativeId,
        correctAlternativeId: correct.id,
        isCorrect:
          eq.selectedAlternativeId !== null &&
          eq.selectedAlternativeId === correct.id,
      };
    }),
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {header}
      <ExamReport exam={reportExam} />
    </section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
pnpm --filter @healthquest/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/exams/\[id\]/page.tsx
git commit -m "feat(web): add /exams/[id] page dispatching between Runner and Report"
```

---

## Task 25: Navigation — add Simulados link to the protected layout

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx` (if it exists and has nav links) or the shell component where questions link lives.

- [ ] **Step 1: Inspect the current nav**

```bash
ls apps/web/src/app/\(app\)
```

Find where the navigation to `/questions` is declared (likely in a layout file or a Sidebar component under `components/`). Read it to see the existing link pattern.

- [ ] **Step 2: Add a `Simulados → /exams` link**

Add a new link entry that mirrors the existing `/questions` link pattern. Label: **Simulados**. Use the same component/style as the sibling links.

- [ ] **Step 3: Verify in dev**

```bash
pnpm --filter @healthquest/web dev
```

Navigate to the protected area. Confirm the Simulados link appears and routes to `/exams`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)
git commit -m "feat(web): add Simulados link to app navigation"
```

---

## Task 26: End-to-end browser smoke test

No automated tests for the UI layer — validate manually.

- [ ] **Step 1: Ensure dev server is running**

```bash
pnpm --filter @healthquest/web dev
```

- [ ] **Step 2: Execute the full flow**

Log in, then:
1. Visit `/exams`. Confirm empty state + form.
2. Create a simulado: pick a subject that has ≥ 5 questions, count 5, no timer. Confirm redirect to `/exams/[id]`.
3. Select an alternative on Q1 — wait a beat, confirm the palette button for Q1 turns "answered" style.
4. Navigate to Q2 via Next. Select. Navigate to Q3 via the palette. Select. Go back to Q1 via palette. Change the answer. Reload the page — confirm selections persisted.
5. Skip Q4 and Q5, click "Finalizar Simulado". Confirm dialog shows "2 questões sem resposta" warning. Cancel.
6. Answer Q4, skip Q5, click Finalizar again. Confirm dialog shows "1 questão sem resposta". Confirm.
7. Page re-renders as the report: summary card + 5 expandable items. Expand each, confirm gabarito + explanation show correctly and wrong answers are flagged.
8. Return to `/exams`. Confirm the finished simulado appears in the list with "Finalizado" badge and percentage.
9. Create a second simulado with a 1-minute timer (set `timeLimit=1` through the form) to smoke-test the countdown. Wait for expiration. Confirm auto-finish and redirect to report.

- [ ] **Step 3: Check all three themes**

In the runner and in the report, toggle `light → dark → code`. Confirm no hardcoded colors leak (palette buttons, dialog backdrop, cards, timer).

- [ ] **Step 4: Final commit (no code — just note the smoke pass)**

If any small fix-ups came out of smoke testing, commit them individually with focused messages.

---

## Self-Review Notes

After finishing all tasks, verify against the spec:

- [ ] All four API endpoints from §3 of the spec are implemented and tested.
- [ ] Schema matches §2 exactly (field names, nullability, relation).
- [ ] Pages `/exams` and `/exams/[id]` exist; the second dispatches by status.
- [ ] All nine components listed in §5 exist with the documented responsibilities.
- [ ] `AlternativeRow` has the `"exam-active"` phase.
- [ ] Edge cases from §7 handled: 422 on insufficient pool, 404 cross-user, 409 on finished exam, timer auto-finish, confirm dialog for unanswered.
- [ ] TDD discipline: every API task has test-first, and tests landed in separate commits from implementation where the spec allows.
- [ ] `responseTime=0` for exam-sourced `AnswerHistory` rows.
