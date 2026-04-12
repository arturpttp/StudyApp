import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

// NOTE: vi.mock is hoisted, so the literal must be inlined here — cannot reference TEST_USER_ID.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_qlist_user", name: "Test", email: "qlist@test.com" },
  }),
}));

const TEST_USER_ID = "__test_qlist_user";

import { GET } from "@/app/api/v1/questions/route";

let subjectId: string;
let institutionId: string;
let questionIds: string[] = [];

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_qlist@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test QList",
      email: "__test_qlist@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();
  subjectId = subject!.id;
  institutionId = institution!.id;

  for (let i = 0; i < 3; i++) {
    const q = await prisma.question.create({
      data: {
        statement: `__test_qlist question ${i}`,
        difficulty: i === 0 ? "EASY" : i === 1 ? "MEDIUM" : "HARD",
        year: 2024 + i,
        subjectId,
        institutionId,
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
          ],
        },
      },
    });
    questionIds.push(q.id);
  }
});

afterAll(async () => {
  await prisma.answerHistory.deleteMany({
    where: { userId: TEST_USER_ID },
  });
  await prisma.alternative.deleteMany({
    where: { questionId: { in: questionIds } },
  });
  await prisma.question.deleteMany({
    where: { id: { in: questionIds } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_qlist" } },
  });
  await prisma.$disconnect();
});

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/v1/questions");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

describe("GET /api/v1/questions", () => {
  it("returns paginated list with defaults", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page", 1);
    expect(body).toHaveProperty("limit", 20);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("filters by difficulty", async () => {
    const res = await GET(makeRequest({ difficulty: "EASY" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const q of body.data) {
      expect(q.difficulty).toBe("EASY");
    }
  });

  it("filters by subjectId", async () => {
    const res = await GET(makeRequest({ subjectId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const q of body.data) {
      expect(q.subject.id).toBe(subjectId);
    }
  });

  it("filters by year", async () => {
    const res = await GET(makeRequest({ year: "2024" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const q of body.data) {
      expect(q.year).toBe(2024);
    }
  });

  it("never exposes isCorrect in alternatives", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    for (const q of body.data) {
      for (const alt of q.alternatives) {
        expect(alt).not.toHaveProperty("isCorrect");
      }
    }
  });

  it("respects page and limit", async () => {
    const res = await GET(makeRequest({ page: "1", limit: "1" }));
    const body = await res.json();

    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(1);
  });

  it("filters unanswered questions", async () => {
    const alts = await prisma.alternative.findMany({
      where: { questionId: questionIds[0] },
    });
    await prisma.answerHistory.create({
      data: {
        userId: TEST_USER_ID,
        questionId: questionIds[0],
        alternativeId: alts[0].id,
        isCorrect: true,
        responseTime: 1000,
      },
    });

    const res = await GET(makeRequest({ unanswered: "true" }));
    const body = await res.json();

    const ids = body.data.map((q: { id: string }) => q.id);
    expect(ids).not.toContain(questionIds[0]);
  });

  it("returns 400 on invalid query params", async () => {
    const res = await GET(makeRequest({ limit: "999" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});
