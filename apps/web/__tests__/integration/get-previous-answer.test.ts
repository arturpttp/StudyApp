import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";
import { getPreviousAnswer } from "@/lib/questions/get-previous-answer";

const TEST_USER_ID = "__test_gpa_user";

let questionId: string;
let otherQuestionId: string;
let correctAltId: string;
let wrongAltId: string;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: "__test_gpa@test.com" },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Test GPA",
      email: "__test_gpa@test.com",
      password: "hashed",
    },
  });

  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  const q = await prisma.question.create({
    data: {
      statement: "__test_gpa question",
      explanation: "__test_gpa explanation",
      difficulty: "EASY",
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "Correct", isCorrect: true, position: 0 },
          { text: "Wrong", isCorrect: false, position: 1 },
        ],
      },
    },
    include: { alternatives: true },
  });

  questionId = q.id;
  correctAltId = q.alternatives.find((a) => a.isCorrect)!.id;
  wrongAltId = q.alternatives.find((a) => !a.isCorrect)!.id;

  const q2 = await prisma.question.create({
    data: {
      statement: "__test_gpa other question",
      explanation: null,
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
  });
  otherQuestionId = q2.id;
});

afterAll(async () => {
  await prisma.answerHistory.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_gpa" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_gpa" } },
  });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

describe("getPreviousAnswer", () => {
  it("returns null when user has no answer for the question", async () => {
    const result = await getPreviousAnswer({
      userId: TEST_USER_ID,
      questionId: otherQuestionId,
    });
    expect(result).toBeNull();
  });

  it("returns the shaped answer when user has answered once", async () => {
    await prisma.answerHistory.create({
      data: {
        userId: TEST_USER_ID,
        questionId,
        alternativeId: wrongAltId,
        isCorrect: false,
        responseTime: 1234,
      },
    });

    const result = await getPreviousAnswer({
      userId: TEST_USER_ID,
      questionId,
    });

    expect(result).toEqual({
      alternativeId: wrongAltId,
      isCorrect: false,
      correctAlternativeId: correctAltId,
      explanation: "__test_gpa explanation",
    });
  });

  it("returns the most recent answer when user has answered multiple times", async () => {
    await prisma.answerHistory.deleteMany({
      where: { userId: TEST_USER_ID, questionId },
    });

    await prisma.answerHistory.create({
      data: {
        userId: TEST_USER_ID,
        questionId,
        alternativeId: wrongAltId,
        isCorrect: false,
        responseTime: 1000,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await prisma.answerHistory.create({
      data: {
        userId: TEST_USER_ID,
        questionId,
        alternativeId: correctAltId,
        isCorrect: true,
        responseTime: 2000,
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    });

    const result = await getPreviousAnswer({
      userId: TEST_USER_ID,
      questionId,
    });

    expect(result).toEqual({
      alternativeId: correctAltId,
      isCorrect: true,
      correctAlternativeId: correctAltId,
      explanation: "__test_gpa explanation",
    });
  });
});
