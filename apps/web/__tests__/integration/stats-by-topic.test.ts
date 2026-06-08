import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/stats/by-topic/route";

const PREFIX = "__test_stats_topic_";
const USER_ID = PREFIX + "user";
let institutionId = "";

beforeEach(async () => {
  await prisma.answerHistory.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: PREFIX } },
  });
  await prisma.topic.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  const inst = await prisma.institution.create({
    data: { name: PREFIX + "inst" },
  });
  institutionId = inst.id;
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.answerHistory.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: PREFIX } },
  });
  await prisma.topic.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  await prisma.$disconnect();
});

async function seedQuestionWithTopic(topicName: string) {
  const topic = await prisma.topic.create({ data: { name: topicName } });
  const q = await prisma.question.create({
    data: {
      statement: PREFIX + "q-" + topicName,
      explanation: "x",
      difficulty: "EASY",
      institutionId,
      topics: { connect: [{ id: topic.id }] },
      alternatives: {
        create: [
          { text: "a", isCorrect: true, position: 0 },
          { text: "b", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });
  return { topic, question: q, correctAltId: q.alternatives[0].id, wrongAltId: q.alternatives[1].id };
}

async function answer(userId: string, questionId: string, altId: string, correct: boolean) {
  return prisma.answerHistory.create({
    data: { userId, questionId, alternativeId: altId, isCorrect: correct, responseTime: 0 },
  });
}

describe("GET /api/v1/stats/by-topic", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty array for a user with no answers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns only topics with >=1 answer, with correct counts and accuracy", async () => {
    const a = await seedQuestionWithTopic(PREFIX + "A");
    const b = await seedQuestionWithTopic(PREFIX + "B");
    await seedQuestionWithTopic(PREFIX + "C");

    await answer(USER_ID, a.question.id, a.correctAltId, true);
    await answer(USER_ID, a.question.id, a.correctAltId, true);
    await answer(USER_ID, a.question.id, a.wrongAltId, false);
    await answer(USER_ID, b.question.id, b.correctAltId, true);

    const res = await GET();
    const body = await res.json();
    expect(body.length).toBe(2);

    const topicA = body.find((t: { topicName: string }) => t.topicName === PREFIX + "A");
    expect(topicA).toMatchObject({
      answered: 3,
      correct: 2,
      accuracy: 67,
    });
    const topicB = body.find((t: { topicName: string }) => t.topicName === PREFIX + "B");
    expect(topicB).toMatchObject({
      answered: 1,
      correct: 1,
      accuracy: 100,
    });
  });

  it("sorts by answered desc, then topicName asc", async () => {
    const a = await seedQuestionWithTopic(PREFIX + "Z-big");
    const b = await seedQuestionWithTopic(PREFIX + "A-tied");
    const c = await seedQuestionWithTopic(PREFIX + "B-tied");

    for (let i = 0; i < 3; i++) await answer(USER_ID, a.question.id, a.correctAltId, true);
    await answer(USER_ID, b.question.id, b.correctAltId, true);
    await answer(USER_ID, c.question.id, c.correctAltId, true);

    const res = await GET();
    const body = await res.json();
    expect(body.map((t: { topicName: string }) => t.topicName)).toEqual([
      PREFIX + "Z-big",
      PREFIX + "A-tied",
      PREFIX + "B-tied",
    ]);
  });

  it("limits to 8 results", async () => {
    for (let i = 0; i < 10; i++) {
      const t = await seedQuestionWithTopic(PREFIX + "topic-" + String(i).padStart(2, "0"));
      await answer(USER_ID, t.question.id, t.correctAltId, true);
    }

    const res = await GET();
    const body = await res.json();
    expect(body.length).toBe(8);
  });
});
