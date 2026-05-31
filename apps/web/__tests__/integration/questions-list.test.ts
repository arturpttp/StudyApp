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

  it("filters by a single topic via topicIds=any", async () => {
    const topicA = await prisma.topic.create({ data: { name: "__test_topicA_single" } });
    const topicB = await prisma.topic.create({ data: { name: "__test_topicB_single" } });

    const q1 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q1 single",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicA.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });
    const q2 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q2 single",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicB.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });

    try {
      const url = new URL(`http://test/api/v1/questions?topicIds=${topicA.id}&topicMatchMode=any`);
      const res = await GET(new Request(url));
      const body = await res.json();

      expect(res.status).toBe(200);
      const ids = body.data.map((q: { id: string }) => q.id);
      expect(ids).toContain(q1.id);
      expect(ids).not.toContain(q2.id);
    } finally {
      await prisma.alternative.deleteMany({ where: { questionId: { in: [q1.id, q2.id] } } });
      await prisma.question.deleteMany({ where: { id: { in: [q1.id, q2.id] } } });
      await prisma.topic.deleteMany({ where: { id: { in: [topicA.id, topicB.id] } } });
    }
  });

  it("filters by multiple topics with mode=any (OR)", async () => {
    const topicA = await prisma.topic.create({ data: { name: "__test_topicA_any" } });
    const topicB = await prisma.topic.create({ data: { name: "__test_topicB_any" } });
    const topicC = await prisma.topic.create({ data: { name: "__test_topicC_any" } });

    const q1 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q1 any",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicA.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });
    const q2 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q2 any",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicB.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });
    const q3 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q3 any",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicC.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });

    try {
      const url = new URL(`http://test/api/v1/questions?topicIds=${topicA.id}&topicIds=${topicB.id}&topicMatchMode=any`);
      const res = await GET(new Request(url));
      const body = await res.json();

      expect(res.status).toBe(200);
      const ids = body.data.map((q: { id: string }) => q.id);
      expect(ids).toContain(q1.id);
      expect(ids).toContain(q2.id);
      expect(ids).not.toContain(q3.id);
    } finally {
      await prisma.alternative.deleteMany({ where: { questionId: { in: [q1.id, q2.id, q3.id] } } });
      await prisma.question.deleteMany({ where: { id: { in: [q1.id, q2.id, q3.id] } } });
      await prisma.topic.deleteMany({ where: { id: { in: [topicA.id, topicB.id, topicC.id] } } });
    }
  });

  it("filters by multiple topics with mode=all (AND)", async () => {
    const topicA = await prisma.topic.create({ data: { name: "__test_topicA_all" } });
    const topicB = await prisma.topic.create({ data: { name: "__test_topicB_all" } });

    const q1 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q1 all (both topics)",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicA.id }, { id: topicB.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });
    const q2 = await prisma.question.create({
      data: {
        statement: "__test_topic_filter Q2 all (one topic only)",
        difficulty: "EASY",
        institutionId,
        topics: { connect: [{ id: topicA.id }] },
        alternatives: {
          create: [
            { text: "A", isCorrect: true, position: 0 },
            { text: "B", isCorrect: false, position: 1 },
            { text: "C", isCorrect: false, position: 2 },
            { text: "D", isCorrect: false, position: 3 },
          ],
        },
      },
    });

    try {
      const url = new URL(`http://test/api/v1/questions?topicIds=${topicA.id}&topicIds=${topicB.id}&topicMatchMode=all`);
      const res = await GET(new Request(url));
      const body = await res.json();

      expect(res.status).toBe(200);
      const ids = body.data.map((q: { id: string }) => q.id);
      expect(ids).toContain(q1.id);
      expect(ids).not.toContain(q2.id);
    } finally {
      await prisma.alternative.deleteMany({ where: { questionId: { in: [q1.id, q2.id] } } });
      await prisma.question.deleteMany({ where: { id: { in: [q1.id, q2.id] } } });
      await prisma.topic.deleteMany({ where: { id: { in: [topicA.id, topicB.id] } } });
    }
  });

  it("returns topics array on each question", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    for (const q of body.data) {
      expect(q).toHaveProperty("topics");
      expect(Array.isArray(q.topics)).toBe(true);
    }
  });
});
