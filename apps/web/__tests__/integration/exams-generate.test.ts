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
