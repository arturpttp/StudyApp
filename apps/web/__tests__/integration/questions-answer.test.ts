import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_qans_user", name: "Test", email: "qans@test.com" },
  }),
}));

const TEST_USER_ID = "__test_qans_user";

import { POST } from "@/app/api/v1/questions/[id]/answer/route";

let questionId: string;
let correctAltId: string;
let wrongAltId: string;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_qans@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test QAns",
      email: "__test_qans@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  const q = await prisma.question.create({
    data: {
      statement: "__test_qans question",
      explanation: "The answer is A because...",
      difficulty: "EASY",
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "Correct answer", isCorrect: true, position: 0 },
          { text: "Wrong answer", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });

  questionId = q.id;
  correctAltId = q.alternatives.find((a) => a.isCorrect)!.id;
  wrongAltId = q.alternatives.find((a) => !a.isCorrect)!.id;
});

afterAll(async () => {
  await prisma.answerHistory.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_qans" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_qans" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "__test_qans" } },
  });
  await prisma.$disconnect();
});

function makeRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/v1/questions/${id}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/questions/[id]/answer", () => {
  it("returns correct=true and explanation for right answer", async () => {
    const res = await POST(makeRequest(questionId, { alternativeId: correctAltId }), {
      params: Promise.resolve({ id: questionId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isCorrect).toBe(true);
    expect(body.explanation).toBe("The answer is A because...");
    expect(body.correctAlternativeId).toBe(correctAltId);
  });

  it("returns correct=false for wrong answer", async () => {
    const res = await POST(makeRequest(questionId, { alternativeId: wrongAltId }), {
      params: Promise.resolve({ id: questionId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isCorrect).toBe(false);
    expect(body.correctAlternativeId).toBe(correctAltId);
  });

  it("saves answer to history", async () => {
    const countBefore = await prisma.answerHistory.count({
      where: { userId: TEST_USER_ID, questionId },
    });

    await POST(makeRequest(questionId, { alternativeId: correctAltId }), {
      params: Promise.resolve({ id: questionId }),
    });

    const countAfter = await prisma.answerHistory.count({
      where: { userId: TEST_USER_ID, questionId },
    });

    expect(countAfter).toBe(countBefore + 1);
  });

  it("returns 400 for missing alternativeId", async () => {
    const res = await POST(makeRequest(questionId, {}), {
      params: Promise.resolve({ id: questionId }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent question", async () => {
    const res = await POST(makeRequest("fake_id", { alternativeId: correctAltId }), {
      params: Promise.resolve({ id: "fake_id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for alternativeId not belonging to question", async () => {
    const res = await POST(makeRequest(questionId, { alternativeId: "nonexistent_alt" }), {
      params: Promise.resolve({ id: questionId }),
    });
    expect(res.status).toBe(400);
  });
});
