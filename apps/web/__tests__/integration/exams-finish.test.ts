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
