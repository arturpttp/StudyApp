# Flashcards (SM-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the flashcard study mode: create manually or from a question, organize by `Topic`, review via SM-2 algorithm with 4 rating buttons (Errei/Difícil/Médio/Fácil), full CRUD with edit/delete.

**Architecture:** Extends the existing `Flashcard` model with SM-2 state fields and an M:N relation to `Topic`. Six new API endpoints under `/api/v1/flashcards/`. Pure SM-2 module unit-tested in isolation. Four UI pages (`/flashcards`, `/flashcards/new`, `/flashcards/[id]/edit`, `/flashcards/review`) and four components under `components/flashcards/`. Creation from a question is a pre-filled redirect to `/flashcards/new`.

**Tech Stack:** Next.js 16.2.3 App Router, Prisma 7.7, Auth.js v5 (JWT), Zod + `@asteasolutions/zod-to-openapi`, Kubb + TanStack Query, Tailwind v4, Vitest + real Postgres.

**Reference files (read before starting):**
- Spec: `docs/superpowers/specs/2026-05-31-flashcards-design.md`
- Project rules: `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/web/src/components/CLAUDE.md`, `apps/web/src/lib/auth/CLAUDE.md`
- Existing patterns:
  - List route + integration test: `apps/web/src/app/api/v1/questions/route.ts`, `apps/web/__tests__/integration/questions-list.test.ts`
  - Single-create POST route: `apps/web/src/app/api/v1/admin/questions/route.ts`, `apps/web/__tests__/integration/admin-questions-create.test.ts`
  - PATCH endpoint pattern (with 404 / 409): `apps/web/src/app/api/v1/exams/[id]/questions/[questionId]/route.ts`
  - Zod schemas: `apps/web/src/lib/api/schemas/exams.ts`
  - Schemas pre-existing in spec: `apps/web/src/lib/api/schemas/admin-questions.ts`
  - Auth helpers: `apps/web/src/lib/api/require-auth.ts`
  - Reusable filter UI: `apps/web/src/components/ui/TopicMultiSelect.tsx`
  - Topic multi-select consumer: `apps/web/src/components/questions/FilterSidebar.tsx`
  - Theming tokens: `apps/web/src/app/globals.css`

---

## File Structure

**Schema:**
- Modify: `packages/db/prisma/schema.prisma` (replace `Flashcard` model, add back-relations on `Question` and `Topic`)

**Pure module:**
- Create: `apps/web/src/lib/flashcards/sm2.ts`
- Create: `apps/web/__tests__/unit/sm2.test.ts`

**Zod schemas:**
- Create: `apps/web/src/lib/api/schemas/flashcards.ts`
- Create: `apps/web/__tests__/unit/flashcard-schemas.test.ts`

**Route handlers (all under `apps/web/src/app/api/v1/flashcards/`):**
- Create: `route.ts` — GET + POST
- Create: `[id]/route.ts` — GET + PATCH + DELETE
- Create: `[id]/review/route.ts` — PATCH

**Integration tests:**
- Create: `apps/web/__tests__/integration/flashcards-list.test.ts`
- Create: `apps/web/__tests__/integration/flashcards-create.test.ts`
- Create: `apps/web/__tests__/integration/flashcards-update.test.ts`
- Create: `apps/web/__tests__/integration/flashcards-review.test.ts`

**OpenAPI / Kubb:**
- Modify: `apps/web/scripts/generate-openapi.ts`

**UI pages (under `apps/web/src/app/(app)/flashcards/`):**
- Create: `page.tsx` — landing
- Create: `new/page.tsx`
- Create: `review/page.tsx`
- Create: `[id]/edit/page.tsx`

**UI components (under `apps/web/src/components/flashcards/`):**
- Create: `FlashcardEditor.tsx` (client) — shared create/update form
- Create: `FlashcardReviewer.tsx` (client) — flip card + 4 rating buttons
- Create: `FlashcardCard.tsx` (server) — list item
- Create: `CreateFlashcardButton.tsx` (client) — button on question detail
- Modify: `apps/web/src/app/(app)/questions/[id]/page.tsx` — render `CreateFlashcardButton`
- Modify: `apps/web/src/app/(app)/layout.tsx` — add `/flashcards` nav link

---

## Commands Cheat Sheet

Run from the repo root unless noted:

- Push schema changes: `pnpm --filter @healthquest/db db:push`
- Regenerate Prisma client: `pnpm --filter @healthquest/db generate`
- Regenerate OpenAPI + Kubb hooks: `pnpm --filter @healthquest/web generate:api`
- Run all tests: `pnpm --filter @healthquest/web test`
- Run a single test file: `pnpm --filter @healthquest/web test path/to/file.test.ts`
- Type check: `pnpm --filter @healthquest/web exec tsc --noEmit`
- Dev server: `pnpm --filter @healthquest/web dev`

---

## Task 1: Prisma schema — extend Flashcard

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Update `Flashcard`, `Question`, and `Topic` models**

Replace the existing `Flashcard` model with the version below. Add a single new field to each of `Question` and `Topic`. Do not touch any other model.

```prisma
model Flashcard {
  id          String    @id @default(cuid())
  user        User      @relation(fields: [userId], references: [id])
  userId      String
  front       String
  back        String
  easeFactor  Float     @default(2.5)
  interval    Int       @default(0)
  repetitions Int       @default(0)
  lastReview  DateTime?
  nextReview  DateTime
  topics      Topic[]
  question    Question? @relation(fields: [questionId], references: [id])
  questionId  String?
  createdAt   DateTime  @default(now())
}
```

In the existing `Question` model, add this line (alongside the other relations):

```prisma
flashcards    Flashcard[]
```

In the existing `Topic` model, add this line:

```prisma
flashcards Flashcard[]
```

- [ ] **Step 2: Push schema and regenerate the client**

```bash
pnpm --filter @healthquest/db db:push
pnpm --filter @healthquest/db generate
```

Expected: `db:push` reports altering `Flashcard` (added `interval`, `repetitions`, `questionId`, `createdAt`; `nextReview` not null), adding `_FlashcardToTopic` join table. `generate` finishes without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): extend Flashcard with SM-2 state, topics M:N, source question"
```

---

## Task 2: SM-2 pure module — failing tests

**Files:**
- Create: `apps/web/__tests__/unit/sm2.test.ts`

- [ ] **Step 1: Write the unit tests**

Create `apps/web/__tests__/unit/sm2.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applySm2 } from "@/lib/flashcards/sm2";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const NEW_CARD = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
};

function days(n: number) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

describe("applySm2", () => {
  it("new card rated Fácil (5) → reps=1, interval=1, EF up", () => {
    const next = applySm2(NEW_CARD, 5, NOW);
    expect(next.repetitions).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBeCloseTo(2.6, 5);
    expect(next.nextReview).toEqual(days(1));
    expect(next.lastReview).toEqual(NOW);
  });

  it("second consecutive correct → interval=6", () => {
    const first = applySm2(NEW_CARD, 4, NOW);
    const second = applySm2(first, 4, NOW);
    expect(second.repetitions).toBe(2);
    expect(second.interval).toBe(6);
  });

  it("third+ consecutive correct → interval = round(prev.interval * EF)", () => {
    let card = applySm2(NEW_CARD, 4, NOW);
    card = applySm2(card, 4, NOW);
    const third = applySm2(card, 4, NOW);
    expect(third.repetitions).toBe(3);
    expect(third.interval).toBe(Math.round(card.interval * card.easeFactor));
  });

  it("Errei (q=0) resets reps to 0 and interval to 1, EF unchanged", () => {
    const card = { easeFactor: 2.8, interval: 30, repetitions: 4 };
    const next = applySm2(card, 0, NOW);
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBe(2.8);
    expect(next.nextReview).toEqual(days(1));
  });

  it("EF floors at 1.3 even after many low ratings", () => {
    let card = { easeFactor: 1.4, interval: 1, repetitions: 1 };
    for (let i = 0; i < 10; i++) card = applySm2(card, 3, NOW);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("rating Médio (4) leaves EF unchanged", () => {
    const next = applySm2(NEW_CARD, 4, NOW);
    expect(next.easeFactor).toBeCloseTo(2.5, 5);
  });

  it("rating Difícil (3) lowers EF", () => {
    const next = applySm2({ ...NEW_CARD }, 3, NOW);
    expect(next.easeFactor).toBeLessThan(2.5);
    expect(next.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/unit/sm2.test.ts
```

Expected: FAILS with `Cannot find module '@/lib/flashcards/sm2'`.

---

## Task 3: SM-2 pure module — implementation

**Files:**
- Create: `apps/web/src/lib/flashcards/sm2.ts`

- [ ] **Step 1: Implement `applySm2`**

Create `apps/web/src/lib/flashcards/sm2.ts`:

```ts
export type Sm2State = {
  easeFactor: number;
  interval: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & {
  lastReview: Date;
  nextReview: Date;
};

export type Rating = 0 | 3 | 4 | 5;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function applySm2(prev: Sm2State, q: Rating, now: Date): Sm2Result {
  let easeFactor = prev.easeFactor;
  let interval: number;
  let repetitions: number;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
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

  return {
    easeFactor,
    interval,
    repetitions,
    lastReview: now,
    nextReview: addDays(now, interval),
  };
}
```

- [ ] **Step 2: Re-run the tests**

```bash
pnpm --filter @healthquest/web test __tests__/unit/sm2.test.ts
```

Expected: PASSES (7 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/flashcards/sm2.ts apps/web/__tests__/unit/sm2.test.ts
git commit -m "feat(web): add pure SM-2 algorithm with unit tests"
```

---

## Task 4: Zod schemas for flashcards

**Files:**
- Create: `apps/web/src/lib/api/schemas/flashcards.ts`
- Create: `apps/web/__tests__/unit/flashcard-schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/unit/flashcard-schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  flashcardsQuerySchema,
  createFlashcardBodySchema,
  updateFlashcardBodySchema,
  reviewFlashcardBodySchema,
} from "@/lib/api/schemas/flashcards";

describe("flashcardsQuerySchema", () => {
  it("defaults dueOnly to false and topicIds to []", () => {
    const parsed = flashcardsQuerySchema.parse({});
    expect(parsed.dueOnly).toBe(false);
    expect(parsed.topicIds).toEqual([]);
  });

  it("accepts dueOnly=true and array topicIds", () => {
    const parsed = flashcardsQuerySchema.parse({
      dueOnly: "true",
      topicIds: ["t1", "t2"],
    });
    expect(parsed.dueOnly).toBe(true);
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
  });

  it("accepts a single topicId as string", () => {
    const parsed = flashcardsQuerySchema.parse({ topicIds: "t1" });
    expect(parsed.topicIds).toEqual(["t1"]);
  });
});

describe("createFlashcardBodySchema", () => {
  it("accepts minimum valid body", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "Q",
      back: "A",
    });
    expect(result.success).toBe(true);
  });

  it("defaults topicIds to []", () => {
    const result = createFlashcardBodySchema.parse({
      front: "Q",
      back: "A",
    });
    expect(result.topicIds).toEqual([]);
  });

  it("rejects empty front", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "",
      back: "A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty back", () => {
    const result = createFlashcardBodySchema.safeParse({
      front: "Q",
      back: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFlashcardBodySchema", () => {
  it("accepts partial update", () => {
    const result = updateFlashcardBodySchema.safeParse({ front: "novo" });
    expect(result.success).toBe(true);
  });

  it("accepts topicIds-only update", () => {
    const result = updateFlashcardBodySchema.safeParse({ topicIds: ["t1"] });
    expect(result.success).toBe(true);
  });

  it("accepts empty body", () => {
    const result = updateFlashcardBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("reviewFlashcardBodySchema", () => {
  it.each([0, 3, 4, 5])("accepts rating %i", (rating) => {
    const result = reviewFlashcardBodySchema.safeParse({ rating });
    expect(result.success).toBe(true);
  });

  it.each([1, 2, 6, -1, "5"])("rejects invalid rating %s", (rating) => {
    const result = reviewFlashcardBodySchema.safeParse({ rating });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/unit/flashcard-schemas.test.ts
```

Expected: FAILS with module not found.

- [ ] **Step 3: Implement the schemas**

Create `apps/web/src/lib/api/schemas/flashcards.ts`:

```ts
import { z } from "zod";

const topicIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  });

export const flashcardsQuerySchema = z.object({
  dueOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional()
    .default("false"),
  topicIds: topicIdsSchema,
});

export type FlashcardsQuery = z.infer<typeof flashcardsQuerySchema>;

export const createFlashcardBodySchema = z.object({
  front: z.string().min(1, "Front é obrigatório."),
  back: z.string().min(1, "Back é obrigatório."),
  topicIds: z.array(z.string()).default([]),
  questionId: z.string().optional(),
});

export type CreateFlashcardBody = z.infer<typeof createFlashcardBodySchema>;

export const updateFlashcardBodySchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  topicIds: z.array(z.string()).optional(),
});

export type UpdateFlashcardBody = z.infer<typeof updateFlashcardBodySchema>;

export const reviewFlashcardBodySchema = z.object({
  rating: z.union([
    z.literal(0),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export type ReviewFlashcardBody = z.infer<typeof reviewFlashcardBodySchema>;
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @healthquest/web test __tests__/unit/flashcard-schemas.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/schemas/flashcards.ts apps/web/__tests__/unit/flashcard-schemas.test.ts
git commit -m "feat(api): add Zod schemas for flashcards endpoints"
```

---

## Task 5: GET /api/v1/flashcards + POST — integration test

**Files:**
- Create: `apps/web/__tests__/integration/flashcards-list.test.ts`
- Create: `apps/web/__tests__/integration/flashcards-create.test.ts`

- [ ] **Step 1: Write list test**

Create `apps/web/__tests__/integration/flashcards-list.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/flashcards/route";

const PREFIX = "__test_fc_list_";
const USER_ID = PREFIX + "user";
const OTHER_USER_ID = PREFIX + "other";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  await prisma.user.create({
    data: { id: OTHER_USER_ID, email: PREFIX + "other@test.com", name: "O" },
  });
  authMock.mockResolvedValue({
    user: { id: USER_ID, role: "STUDENT" },
  });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

function req(url: string) {
  return new Request("http://test" + url);
}

describe("GET /api/v1/flashcards", () => {
  it("returns only the current user's cards", async () => {
    const now = new Date();
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "mine",
        back: "back",
        nextReview: now,
      },
    });
    await prisma.flashcard.create({
      data: {
        userId: OTHER_USER_ID,
        front: "theirs",
        back: "back",
        nextReview: now,
      },
    });

    const res = await GET(req("/api/v1/flashcards"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("mine");
  });

  it("filters by dueOnly=true", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 86400 * 1000);
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "due now", back: "b", nextReview: now },
    });
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "later", back: "b", nextReview: future },
    });

    const res = await GET(req("/api/v1/flashcards?dueOnly=true"));
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("due now");
  });

  it("filters by topicIds (any-match)", async () => {
    const topicA = await prisma.topic.create({
      data: { name: PREFIX + "A" },
    });
    const topicB = await prisma.topic.create({
      data: { name: PREFIX + "B" },
    });
    const now = new Date();
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "A only",
        back: "b",
        nextReview: now,
        topics: { connect: [{ id: topicA.id }] },
      },
    });
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "B only",
        back: "b",
        nextReview: now,
        topics: { connect: [{ id: topicB.id }] },
      },
    });
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "neither", back: "b", nextReview: now },
    });

    const res = await GET(req(`/api/v1/flashcards?topicIds=${topicA.id}`));
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("A only");
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req("/api/v1/flashcards"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Write create test**

Create `apps/web/__tests__/integration/flashcards-create.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST } from "@/app/api/v1/flashcards/route";

const PREFIX = "__test_fc_create_";
const USER_ID = PREFIX + "user";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

function makeReq(body: unknown): Request {
  return new Request("http://test/api/v1/flashcards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/flashcards", () => {
  it("creates a card with nextReview=now", async () => {
    const before = Date.now();
    const res = await POST(
      makeReq({ front: "Q?", back: "A!" }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const card = await prisma.flashcard.findUnique({ where: { id } });
    expect(card).not.toBeNull();
    expect(card!.front).toBe("Q?");
    expect(card!.back).toBe("A!");
    expect(card!.userId).toBe(USER_ID);
    expect(card!.easeFactor).toBe(2.5);
    expect(card!.interval).toBe(0);
    expect(card!.repetitions).toBe(0);
    expect(card!.lastReview).toBeNull();
    expect(card!.nextReview.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("links topics when provided", async () => {
    const topic = await prisma.topic.create({
      data: { name: PREFIX + "topic" },
    });
    const res = await POST(
      makeReq({ front: "Q", back: "A", topicIds: [topic.id] }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const card = await prisma.flashcard.findUnique({
      where: { id },
      include: { topics: true },
    });
    expect(card!.topics.map((t) => t.id)).toContain(topic.id);
  });

  it("returns 404 when questionId does not exist", async () => {
    const res = await POST(
      makeReq({ front: "Q", back: "A", questionId: "does-not-exist" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when front is empty", async () => {
    const res = await POST(makeReq({ front: "", back: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq({ front: "Q", back: "A" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-list.test.ts __tests__/integration/flashcards-create.test.ts
```

Expected: FAIL with module not found for `@/app/api/v1/flashcards/route`.

---

## Task 6: GET + POST /api/v1/flashcards — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/flashcards/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/flashcards/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import {
  flashcardsQuerySchema,
  createFlashcardBodySchema,
} from "@/lib/api/schemas/flashcards";

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

  const parsed = flashcardsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const { dueOnly, topicIds: ids } = parsed.data;

  const where: Record<string, unknown> = { userId: session.user.id };
  if (dueOnly) where.nextReview = { lte: new Date() };
  if (ids.length > 0) where.topics = { some: { id: { in: ids } } };

  const cards = await prisma.flashcard.findMany({
    where,
    select: {
      id: true,
      front: true,
      back: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
      lastReview: true,
      nextReview: true,
      questionId: true,
      createdAt: true,
      topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
    orderBy: { nextReview: "asc" },
  });

  return Response.json(cards);
}

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

  const parsed = createFlashcardBodySchema.safeParse(body);
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

  if (data.questionId) {
    const q = await prisma.question.findUnique({
      where: { id: data.questionId },
      select: { id: true },
    });
    if (!q) {
      return Response.json(
        { error: "Questão não encontrada." },
        { status: 404 },
      );
    }
  }

  const card = await prisma.flashcard.create({
    data: {
      userId: session.user.id,
      front: data.front,
      back: data.back,
      nextReview: new Date(),
      questionId: data.questionId ?? null,
      topics: { connect: data.topicIds.map((id) => ({ id })) },
    },
    select: { id: true },
  });

  return Response.json({ id: card.id }, { status: 201 });
}
```

- [ ] **Step 2: Re-run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-list.test.ts __tests__/integration/flashcards-create.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/flashcards/route.ts apps/web/__tests__/integration/flashcards-list.test.ts apps/web/__tests__/integration/flashcards-create.test.ts
git commit -m "feat(api): add GET and POST /api/v1/flashcards"
```

---

## Task 7: GET + PATCH + DELETE /api/v1/flashcards/[id] — integration test

**Files:**
- Create: `apps/web/__tests__/integration/flashcards-update.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/__tests__/integration/flashcards-update.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET, PATCH, DELETE } from "@/app/api/v1/flashcards/[id]/route";

const PREFIX = "__test_fc_upd_";
const USER_ID = PREFIX + "user";
const OTHER_USER_ID = PREFIX + "other";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  await prisma.user.create({
    data: { id: OTHER_USER_ID, email: PREFIX + "other@test.com", name: "O" },
  });
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

async function makeCard(userId: string) {
  return prisma.flashcard.create({
    data: {
      userId,
      front: "f",
      back: "b",
      nextReview: new Date(),
    },
  });
}

function makeReq(method: string, body?: unknown): Request {
  return new Request("http://test", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/flashcards/[id]", () => {
  it("returns the card when owned by user", async () => {
    const card = await makeCard(USER_ID);
    const res = await GET(makeReq("GET"), ctx(card.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(card.id);
  });

  it("returns 404 when card belongs to another user", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await GET(makeReq("GET"), ctx(card.id));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/flashcards/[id]", () => {
  it("updates content without touching SR state", async () => {
    const card = await makeCard(USER_ID);
    const before = card.easeFactor;

    const res = await PATCH(
      makeReq("PATCH", { front: "novo front" }),
      ctx(card.id),
    );
    expect(res.status).toBe(204);

    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.front).toBe("novo front");
    expect(updated!.easeFactor).toBe(before);
    expect(updated!.repetitions).toBe(card.repetitions);
  });

  it("returns 404 for non-owner", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await PATCH(makeReq("PATCH", { front: "x" }), ctx(card.id));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/flashcards/[id]", () => {
  it("deletes the card", async () => {
    const card = await makeCard(USER_ID);
    const res = await DELETE(makeReq("DELETE"), ctx(card.id));
    expect(res.status).toBe(204);
    expect(
      await prisma.flashcard.findUnique({ where: { id: card.id } }),
    ).toBeNull();
  });

  it("returns 404 for non-owner", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await DELETE(makeReq("DELETE"), ctx(card.id));
    expect(res.status).toBe(404);
    expect(
      await prisma.flashcard.findUnique({ where: { id: card.id } }),
    ).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-update.test.ts
```

Expected: FAILS with module not found.

---

## Task 8: GET + PATCH + DELETE /api/v1/flashcards/[id] — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/flashcards/[id]/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/flashcards/[id]/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { updateFlashcardBodySchema } from "@/lib/api/schemas/flashcards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      front: true,
      back: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
      lastReview: true,
      nextReview: true,
      questionId: true,
      createdAt: true,
      topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });

  if (!card) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  return Response.json(card);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = updateFlashcardBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const owned = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  const data = parsed.data;
  await prisma.flashcard.update({
    where: { id },
    data: {
      ...(data.front !== undefined && { front: data.front }),
      ...(data.back !== undefined && { back: data.back }),
      ...(data.topicIds !== undefined && {
        topics: { set: data.topicIds.map((tid) => ({ id: tid })) },
      }),
    },
  });

  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const owned = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  await prisma.flashcard.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Re-run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-update.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/flashcards/[id]/route.ts apps/web/__tests__/integration/flashcards-update.test.ts
git commit -m "feat(api): add GET, PATCH, DELETE /api/v1/flashcards/[id]"
```

---

## Task 9: PATCH /api/v1/flashcards/[id]/review — integration test

**Files:**
- Create: `apps/web/__tests__/integration/flashcards-review.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/__tests__/integration/flashcards-review.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { PATCH } from "@/app/api/v1/flashcards/[id]/review/route";

const PREFIX = "__test_fc_review_";
const USER_ID = PREFIX + "user";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

async function newCard() {
  return prisma.flashcard.create({
    data: { userId: USER_ID, front: "f", back: "b", nextReview: new Date() },
  });
}

function makeReq(body: unknown): Request {
  return new Request("http://test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/v1/flashcards/[id]/review", () => {
  it("Fácil (5) advances reps to 1 and interval to 1", async () => {
    const card = await newCard();
    const res = await PATCH(makeReq({ rating: 5 }), ctx(card.id));
    expect(res.status).toBe(200);
    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.repetitions).toBe(1);
    expect(updated!.interval).toBe(1);
    expect(updated!.lastReview).not.toBeNull();
  });

  it("Errei (0) on a learned card resets reps to 0", async () => {
    const card = await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "f",
        back: "b",
        nextReview: new Date(),
        easeFactor: 2.7,
        interval: 14,
        repetitions: 4,
      },
    });
    const res = await PATCH(makeReq({ rating: 0 }), ctx(card.id));
    expect(res.status).toBe(200);
    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.repetitions).toBe(0);
    expect(updated!.interval).toBe(1);
    expect(updated!.easeFactor).toBe(2.7);
  });

  it("returns 400 for invalid rating", async () => {
    const card = await newCard();
    const res = await PATCH(makeReq({ rating: 2 }), ctx(card.id));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owner card", async () => {
    const other = await prisma.user.create({
      data: { id: PREFIX + "other", email: PREFIX + "o@test.com", name: "O" },
    });
    const card = await prisma.flashcard.create({
      data: { userId: other.id, front: "f", back: "b", nextReview: new Date() },
    });
    const res = await PATCH(makeReq({ rating: 5 }), ctx(card.id));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-review.test.ts
```

Expected: FAILS with module not found.

---

## Task 10: PATCH /api/v1/flashcards/[id]/review — implementation

**Files:**
- Create: `apps/web/src/app/api/v1/flashcards/[id]/review/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/v1/flashcards/[id]/review/route.ts`:

```ts
import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { reviewFlashcardBodySchema } from "@/lib/api/schemas/flashcards";
import { applySm2 } from "@/lib/flashcards/sm2";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = reviewFlashcardBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Rating inválido." },
      { status: 400 },
    );
  }

  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
    },
  });
  if (!card) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  const next = applySm2(card, parsed.data.rating, new Date());

  const updated = await prisma.flashcard.update({
    where: { id },
    data: {
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      lastReview: next.lastReview,
      nextReview: next.nextReview,
    },
    select: {
      id: true,
      front: true,
      back: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
      lastReview: true,
      nextReview: true,
      questionId: true,
      createdAt: true,
      topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });

  return Response.json(updated);
}
```

- [ ] **Step 2: Re-run tests**

```bash
pnpm --filter @healthquest/web test __tests__/integration/flashcards-review.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/flashcards/[id]/review/route.ts apps/web/__tests__/integration/flashcards-review.test.ts
git commit -m "feat(api): add PATCH /api/v1/flashcards/[id]/review with SM-2"
```

---

## Task 11: Register flashcard routes in OpenAPI + regen Kubb

**Files:**
- Modify: `apps/web/scripts/generate-openapi.ts`

- [ ] **Step 1: Add Flashcard schema and route registrations**

In `apps/web/scripts/generate-openapi.ts`, after the existing `TopicSchema` registration (or anywhere in the schemas block), add:

```ts
const FlashcardSchema = registry.register(
  "Flashcard",
  z.object({
    id: z.string(),
    front: z.string(),
    back: z.string(),
    easeFactor: z.number(),
    interval: z.number().int(),
    repetitions: z.number().int(),
    lastReview: z.string().datetime().nullable(),
    nextReview: z.string().datetime(),
    questionId: z.string().nullable(),
    createdAt: z.string().datetime(),
    topics: z.array(TopicSchema),
  }),
);
```

Then, before the `// --- Generate ---` section, add the six route registrations:

```ts
// --- Route: GET /api/v1/flashcards ---
registry.registerPath({
  method: "get",
  path: "/api/v1/flashcards",
  summary: "Listar flashcards",
  request: {
    query: z.object({
      dueOnly: z.enum(["true", "false"]).optional(),
      topicIds: z.array(z.string()).optional(),
    }),
  },
  responses: {
    200: {
      description: "Lista de flashcards do usuário",
      content: { "application/json": { schema: z.array(FlashcardSchema) } },
    },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: POST /api/v1/flashcards ---
registry.registerPath({
  method: "post",
  path: "/api/v1/flashcards",
  summary: "Criar flashcard",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            front: z.string().min(1),
            back: z.string().min(1),
            topicIds: z.array(z.string()).optional(),
            questionId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Flashcard criado",
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
    404: {
      description: "Recurso não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: GET /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "get",
  path: "/api/v1/flashcards/{id}",
  summary: "Buscar flashcard",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Flashcard",
      content: { "application/json": { schema: FlashcardSchema } },
    },
    404: {
      description: "Flashcard não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "patch",
  path: "/api/v1/flashcards/{id}",
  summary: "Atualizar flashcard",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            front: z.string().min(1).optional(),
            back: z.string().min(1).optional(),
            topicIds: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Atualizado" },
    400: {
      description: "Dados inválidos",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: DELETE /api/v1/flashcards/{id} ---
registry.registerPath({
  method: "delete",
  path: "/api/v1/flashcards/{id}",
  summary: "Excluir flashcard",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: "Excluído" },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

// --- Route: PATCH /api/v1/flashcards/{id}/review ---
registry.registerPath({
  method: "patch",
  path: "/api/v1/flashcards/{id}/review",
  summary: "Revisar flashcard (SM-2)",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            rating: z.union([
              z.literal(0),
              z.literal(3),
              z.literal(4),
              z.literal(5),
            ]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estado pós-revisão",
      content: { "application/json": { schema: FlashcardSchema } },
    },
    400: {
      description: "Rating inválido",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Não encontrado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});
```

- [ ] **Step 2: Regenerate**

```bash
pnpm --filter @healthquest/web generate:api
```

Expected: creates `useGetApiV1Flashcards`, `usePostApiV1Flashcards`, `useGetApiV1FlashcardsId`, `usePatchApiV1FlashcardsId`, `useDeleteApiV1FlashcardsId`, `usePatchApiV1FlashcardsIdReview` hooks under `apps/web/src/lib/api/generated/hooks/`. Look for `Files written successfully` / `Generation completed`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/generate-openapi.ts apps/web/src/lib/api/generated apps/web/openapi.json
git commit -m "feat(api): register Flashcard routes in OpenAPI and regen Kubb hooks"
```

---

## Task 12: FlashcardEditor component

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardEditor.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/flashcards/FlashcardEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostApiV1Flashcards } from "@/lib/api/generated/hooks/usePostApiV1Flashcards";
import { usePatchApiV1FlashcardsId } from "@/lib/api/generated/hooks/usePatchApiV1FlashcardsId";
import { useGetApiV1Topics } from "@/lib/api/generated/hooks/useGetApiV1Topics";
import { Button } from "@/components/ui/Button";
import { TopicMultiSelect } from "@/components/ui/TopicMultiSelect";

interface FlashcardEditorProps {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    front: string;
    back: string;
    topicIds: string[];
    questionId?: string | null;
  };
}

export function FlashcardEditor({ mode, initial }: FlashcardEditorProps) {
  const router = useRouter();
  const { data: topics } = useGetApiV1Topics();
  const createMutation = usePostApiV1Flashcards();
  const updateMutation = usePatchApiV1FlashcardsId();

  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [topicIds, setTopicIds] = useState<string[]>(initial?.topicIds ?? []);
  const [serverError, setServerError] = useState<string | null>(null);

  const questionId = initial?.questionId ?? undefined;
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (mode === "create") {
      createMutation.mutate(
        {
          data: {
            front,
            back,
            topicIds,
            questionId: questionId ?? undefined,
          },
        },
        {
          onSuccess: () => router.push("/flashcards"),
          onError: async (err) => {
            const anyErr = err as { response?: Response };
            if (anyErr.response) {
              try {
                const body = await anyErr.response.clone().json();
                setServerError(body.error ?? "Erro ao criar flashcard.");
                return;
              } catch {}
            }
            setServerError("Erro ao criar flashcard.");
          },
        },
      );
    } else {
      if (!initial?.id) return;
      updateMutation.mutate(
        { id: initial.id, data: { front, back, topicIds } },
        {
          onSuccess: () => router.push("/flashcards"),
          onError: () => setServerError("Erro ao atualizar flashcard."),
        },
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 space-y-4"
    >
      <label className="block space-y-1">
        <span className="text-sm text-muted">Frente</span>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">Verso</span>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="space-y-1">
        <span className="text-sm text-muted">Matérias (opcional)</span>
        <TopicMultiSelect
          topics={topics ?? []}
          selectedIds={topicIds}
          matchMode="any"
          onToggle={(id) =>
            setTopicIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onMatchModeChange={() => {}}
          label=""
        />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Salvando..."
          : mode === "create"
            ? "Criar flashcard"
            : "Salvar alterações"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/flashcards/FlashcardEditor.tsx
git commit -m "feat(web): add FlashcardEditor shared create/update form"
```

---

## Task 13: FlashcardCard component (list item)

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardCard.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/flashcards/FlashcardCard.tsx`:

```tsx
import Link from "next/link";
import { DeleteFlashcardButton } from "./DeleteFlashcardButton";

interface FlashcardCardProps {
  card: {
    id: string;
    front: string;
    back: string;
    nextReview: Date;
    topics: { id: string; name: string }[];
  };
}

function snippet(text: string, max = 140): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export function FlashcardCard({ card }: FlashcardCardProps) {
  const isDue = card.nextReview.getTime() <= Date.now();

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium text-foreground">{snippet(card.front)}</p>
          <p className="text-xs text-muted">{snippet(card.back)}</p>
        </div>
        {isDue && (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-primary-foreground">
            Due
          </span>
        )}
      </div>
      {card.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.topics.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs">
        <Link
          href={`/flashcards/${card.id}/edit`}
          className="text-accent hover:underline cursor-pointer"
        >
          Editar
        </Link>
        <DeleteFlashcardButton id={card.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the DeleteFlashcardButton client subcomponent**

Create `apps/web/src/components/flashcards/DeleteFlashcardButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useDeleteApiV1FlashcardsId } from "@/lib/api/generated/hooks/useDeleteApiV1FlashcardsId";

interface DeleteFlashcardButtonProps {
  id: string;
}

export function DeleteFlashcardButton({ id }: DeleteFlashcardButtonProps) {
  const router = useRouter();
  const mutation = useDeleteApiV1FlashcardsId();

  function handleClick() {
    if (!window.confirm("Excluir este flashcard?")) return;
    mutation.mutate(
      { id },
      {
        onSuccess: () => router.refresh(),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      className="text-danger hover:underline cursor-pointer disabled:opacity-60"
    >
      {mutation.isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/flashcards/FlashcardCard.tsx apps/web/src/components/flashcards/DeleteFlashcardButton.tsx
git commit -m "feat(web): add FlashcardCard list item and DeleteFlashcardButton"
```

---

## Task 14: FlashcardReviewer component

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardReviewer.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/flashcards/FlashcardReviewer.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePatchApiV1FlashcardsIdReview } from "@/lib/api/generated/hooks/usePatchApiV1FlashcardsIdReview";
import { Button } from "@/components/ui/Button";

interface ReviewCard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardReviewerProps {
  cards: ReviewCard[];
}

const RATINGS: Array<{ rating: 0 | 3 | 4 | 5; label: string; variant: "danger" | "outline" | "primary" }> = [
  { rating: 0, label: "Errei", variant: "danger" },
  { rating: 3, label: "Difícil", variant: "outline" },
  { rating: 4, label: "Médio", variant: "outline" },
  { rating: 5, label: "Fácil", variant: "primary" },
];

export function FlashcardReviewer({ cards }: FlashcardReviewerProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const mutation = usePatchApiV1FlashcardsIdReview();

  const current = cards[index];
  const done = index >= cards.length;

  function handleRate(rating: 0 | 3 | 4 | 5) {
    if (!current) return;
    mutation.mutate(
      { id: current.id, data: { rating } },
      {
        onSettled: () => {
          setIndex((i) => i + 1);
          setFlipped(false);
        },
      },
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center space-y-3">
        <p className="text-foreground">Nada para revisar agora. 🎉</p>
        <Link
          href="/flashcards"
          className="inline-block text-sm text-accent hover:underline cursor-pointer"
        >
          Voltar
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center space-y-3">
        <p className="text-foreground">
          Sessão concluída — {cards.length} card{cards.length === 1 ? "" : "s"} revisado{cards.length === 1 ? "" : "s"}.
        </p>
        <Link
          href="/flashcards"
          className="inline-block text-sm text-accent hover:underline cursor-pointer"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted text-center">
        {index + 1} de {cards.length}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="block w-full rounded-lg border border-border bg-surface p-8 min-h-48 text-left transition-colors cursor-pointer hover:border-accent"
      >
        <p className="text-xs text-muted mb-2">
          {flipped ? "Verso" : "Frente"}
        </p>
        <p className="text-foreground whitespace-pre-wrap">
          {flipped ? current.back : current.front}
        </p>
        {!flipped && (
          <p className="text-xs text-muted mt-4 text-center">Clique para virar</p>
        )}
      </button>

      {flipped && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <Button
              key={r.rating}
              type="button"
              variant={r.variant}
              onClick={() => handleRate(r.rating)}
              disabled={mutation.isPending}
            >
              {r.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/flashcards/FlashcardReviewer.tsx
git commit -m "feat(web): add FlashcardReviewer flip card with 4 rating buttons"
```

---

## Task 15: /flashcards landing page

**Files:**
- Create: `apps/web/src/app/(app)/flashcards/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(app)/flashcards/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { Button } from "@/components/ui/Button";
import { FlashcardCard } from "@/components/flashcards/FlashcardCard";

export default async function FlashcardsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const [dueCount, cards] = await Promise.all([
    prisma.flashcard.count({
      where: { userId: session.user.id, nextReview: { lte: now } },
    }),
    prisma.flashcard.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        front: true,
        back: true,
        nextReview: true,
        topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
    }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Flashcards</h1>
        <p className="text-sm text-muted">
          {dueCount > 0
            ? `Você tem ${dueCount} card${dueCount === 1 ? "" : "s"} para revisar agora.`
            : "Nenhum card aguardando revisão."}
        </p>
      </header>

      <div className="flex gap-2">
        {dueCount > 0 && (
          <Link href="/flashcards/review">
            <Button type="button">Começar revisão</Button>
          </Link>
        )}
        <Link href="/flashcards/new">
          <Button type="button" variant="outline">
            + Criar novo
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Meus flashcards</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não criou nenhum flashcard.
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <FlashcardCard key={c.id} card={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/(app)/flashcards/page.tsx"
git commit -m "feat(web): add /flashcards landing page"
```

---

## Task 16: /flashcards/new page

**Files:**
- Create: `apps/web/src/app/(app)/flashcards/new/page.tsx`

- [ ] **Step 1: Create the page (with optional pre-fill from question)**

Create `apps/web/src/app/(app)/flashcards/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardEditor } from "@/components/flashcards/FlashcardEditor";

type PageProps = { searchParams: Promise<{ questionId?: string }> };

export default async function NewFlashcardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { questionId } = await searchParams;

  let initial: { front: string; back: string; topicIds: string[]; questionId?: string | null } = {
    front: "",
    back: "",
    topicIds: [],
  };

  if (questionId) {
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        statement: true,
        explanation: true,
        alternatives: {
          select: { text: true, isCorrect: true },
          orderBy: { position: "asc" },
        },
        topics: { select: { id: true } },
      },
    });
    if (q) {
      const correct = q.alternatives.find((a) => a.isCorrect);
      initial = {
        front: q.statement,
        back:
          (correct ? correct.text : "") +
          (q.explanation ? "\n\n" + q.explanation : ""),
        topicIds: q.topics.map((t) => t.id),
        questionId: q.id,
      };
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Novo flashcard</h1>
        <p className="text-sm text-muted">
          Frente e verso são livres — formate como preferir.
        </p>
      </header>
      <FlashcardEditor mode="create" initial={initial} />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/(app)/flashcards/new/page.tsx"
git commit -m "feat(web): add /flashcards/new page with question pre-fill"
```

---

## Task 17: /flashcards/[id]/edit page

**Files:**
- Create: `apps/web/src/app/(app)/flashcards/[id]/edit/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(app)/flashcards/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardEditor } from "@/components/flashcards/FlashcardEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditFlashcardPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      front: true,
      back: true,
      questionId: true,
      topics: { select: { id: true } },
    },
  });
  if (!card) notFound();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Editar flashcard</h1>
        <p className="text-sm text-muted">
          Editar conteúdo não reseta o progresso de revisão.
        </p>
      </header>
      <FlashcardEditor
        mode="edit"
        initial={{
          id: card.id,
          front: card.front,
          back: card.back,
          topicIds: card.topics.map((t) => t.id),
          questionId: card.questionId,
        }}
      />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/(app)/flashcards/[id]/edit/page.tsx"
git commit -m "feat(web): add /flashcards/[id]/edit page"
```

---

## Task 18: /flashcards/review page

**Files:**
- Create: `apps/web/src/app/(app)/flashcards/review/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(app)/flashcards/review/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardReviewer } from "@/components/flashcards/FlashcardReviewer";

export default async function ReviewFlashcardsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id, nextReview: { lte: new Date() } },
    orderBy: { nextReview: "asc" },
    select: { id: true, front: true, back: true },
  });

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/flashcards"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        &larr; Flashcards
      </Link>
      <FlashcardReviewer cards={cards} />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/(app)/flashcards/review/page.tsx"
git commit -m "feat(web): add /flashcards/review session page"
```

---

## Task 19: CreateFlashcardButton on question detail

**Files:**
- Create: `apps/web/src/components/flashcards/CreateFlashcardButton.tsx`
- Modify: `apps/web/src/app/(app)/questions/[id]/page.tsx`

- [ ] **Step 1: Create the button**

Create `apps/web/src/components/flashcards/CreateFlashcardButton.tsx`:

```tsx
"use client";

import Link from "next/link";

interface CreateFlashcardButtonProps {
  questionId: string;
}

export function CreateFlashcardButton({ questionId }: CreateFlashcardButtonProps) {
  return (
    <Link
      href={`/flashcards/new?questionId=${questionId}`}
      className="inline-flex items-center rounded border border-border bg-surface px-3 py-1 text-xs text-foreground hover:border-accent transition-colors cursor-pointer"
    >
      + Criar flashcard
    </Link>
  );
}
```

- [ ] **Step 2: Render it on the question detail page**

In `apps/web/src/app/(app)/questions/[id]/page.tsx`, add the import:

```ts
import { CreateFlashcardButton } from "@/components/flashcards/CreateFlashcardButton";
```

Then render `<CreateFlashcardButton questionId={question.id} />` somewhere visible in the page header (e.g., near the existing chips block). Pick a spot that fits the existing layout — the smallest non-invasive change is right after the topic chips row.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/flashcards/CreateFlashcardButton.tsx "apps/web/src/app/(app)/questions/[id]/page.tsx"
git commit -m "feat(web): add CreateFlashcardButton on question detail"
```

---

## Task 20: Nav link + middleware

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Add Flashcards link to nav**

In `apps/web/src/app/(app)/layout.tsx`, inside the `<nav>` element (after Simulados, before the admin link), add:

```tsx
<Link href="/flashcards" className="text-muted hover:text-foreground transition-colors">
  Flashcards
</Link>
```

- [ ] **Step 2: Add /flashcards to middleware matcher**

In `apps/web/middleware.ts`, replace the `config` export:

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/questions/:path*",
    "/exams/:path*",
    "/flashcards/:path*",
    "/admin/:path*",
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/layout.tsx" apps/web/middleware.ts
git commit -m "feat(web): wire Flashcards into nav and middleware"
```

---

## Task 21: End-to-end browser smoke test

No automated tests for the UI layer — validate manually.

- [ ] **Step 1: Ensure dev server is running**

```bash
pnpm --filter @healthquest/web dev
```

- [ ] **Step 2: Manual flows**

Logged in as a STUDENT (or ADMIN — both should work the same here):

1. Click **Flashcards** in the header → `/flashcards` opens. Confirm "Nenhum card aguardando revisão." and empty "Meus flashcards" list.
2. Click **+ Criar novo** → `/flashcards/new`. Type a front and back. Submit → redirect to `/flashcards`. Confirm the card appears with a **Due** badge.
3. Click **Editar** → `/flashcards/[id]/edit`. Change the back text. Save → redirect. Card reflects the new back.
4. Click **Começar revisão** → `/flashcards/review`. Click card to flip. Click **Fácil** → next card (or session complete if only one).
5. After session: refresh `/flashcards` — the card you reviewed should no longer have the **Due** badge (its `nextReview` advanced).
6. Go to `/questions/<some-id>`. Click **+ Criar flashcard**. Confirm `/flashcards/new` opens with front pre-filled with the statement and back pre-filled with the correct alternative (+ explanation if present). Submit.
7. Back at `/flashcards`, confirm the new card carries the question's topics as chips.
8. Click **Excluir** on a card. Confirm prompt, click OK. Card disappears.

- [ ] **Step 3: Theme check**

Toggle `light → dark → code` on `/flashcards`, `/flashcards/new`, `/flashcards/review`. Confirm no hardcoded colors leak — flip card, rating buttons, chips, badges all use semantic tokens.

- [ ] **Step 4: Optional fix commits**

If anything breaks during smoke, fix individually with focused commits.

---

## Self-Review Notes

After finishing all tasks, verify against the spec:

- [ ] Schema: `Flashcard` extended with `interval`, `repetitions`, `topics`, `question`/`questionId`, `createdAt`; `nextReview` non-null (Task 1).
- [ ] SM-2 pure module passes all 7 unit tests, including new card, errei reset, EF floor, EF growth (Tasks 2–3).
- [ ] Zod schemas reject invalid bodies, accept defaults (Task 4).
- [ ] All 6 endpoints implemented with TDD: list/create (5–6), get/patch/delete (7–8), review (9–10).
- [ ] OpenAPI registered + Kubb hooks regenerated for all 6 routes (Task 11).
- [ ] UI: editor (12), card + delete (13), reviewer (14), 4 pages (15–18), question button (19), nav + middleware (20).
- [ ] Smoke test covers create-from-question pre-fill, review flow, edit, delete, themes (21).
- [ ] No `FlashcardReview` log added (deferred per spec).
