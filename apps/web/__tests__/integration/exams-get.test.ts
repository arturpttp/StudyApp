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
