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
