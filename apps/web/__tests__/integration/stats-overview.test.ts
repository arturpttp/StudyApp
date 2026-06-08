import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/stats/overview/route";

const PREFIX = "__test_stats_ov_";
const USER_ID = PREFIX + "user";
const OTHER_USER_ID = PREFIX + "other";
let institutionId = "";
let questionId = "";
let alternativeId = "";

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
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  await prisma.user.create({
    data: { id: OTHER_USER_ID, email: PREFIX + "other@test.com", name: "O" },
  });
  const inst = await prisma.institution.create({
    data: { name: PREFIX + "inst" },
  });
  institutionId = inst.id;
  const q = await prisma.question.create({
    data: {
      statement: PREFIX + "Pergunta?",
      explanation: "x",
      difficulty: "EASY",
      institutionId,
      alternatives: {
        create: [
          { text: "a", isCorrect: true, position: 0 },
          { text: "b", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });
  questionId = q.id;
  alternativeId = q.alternatives[0].id;
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
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  await prisma.$disconnect();
});

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function seedAnswer(userId: string, when: Date, correct: boolean) {
  return prisma.answerHistory.create({
    data: {
      userId,
      questionId,
      alternativeId,
      isCorrect: correct,
      responseTime: 0,
      createdAt: when,
    },
  });
}

describe("GET /api/v1/stats/overview", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns zeroes for a user with no activity", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalAnswered).toBe(0);
    expect(body.totalCorrect).toBe(0);
    expect(body.accuracyAll).toBe(0);
    expect(body.totalAnsweredWeek).toBe(0);
    expect(body.accuracyWeek).toBe(0);
    expect(body.currentStreak).toBe(0);
  });

  it("aggregates totals and accuracy correctly", async () => {
    await seedAnswer(USER_ID, daysAgo(0), true);
    await seedAnswer(USER_ID, daysAgo(0), true);
    await seedAnswer(USER_ID, daysAgo(0), false);
    await seedAnswer(USER_ID, daysAgo(30), true);

    const res = await GET();
    const body = await res.json();
    expect(body.totalAnswered).toBe(4);
    expect(body.totalCorrect).toBe(3);
    expect(body.accuracyAll).toBe(75);
    expect(body.totalAnsweredWeek).toBe(3);
    expect(body.accuracyWeek).toBe(67);
  });

  it("computes streak across consecutive days", async () => {
    await seedAnswer(USER_ID, daysAgo(0), true);
    await seedAnswer(USER_ID, daysAgo(1), true);
    await seedAnswer(USER_ID, daysAgo(2), false);

    const res = await GET();
    const body = await res.json();
    expect(body.currentStreak).toBe(3);
  });

  it("does not include another user's data", async () => {
    await seedAnswer(OTHER_USER_ID, daysAgo(0), true);
    await seedAnswer(OTHER_USER_ID, daysAgo(0), true);

    const res = await GET();
    const body = await res.json();
    expect(body.totalAnswered).toBe(0);
  });
});
