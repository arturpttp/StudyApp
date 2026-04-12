import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_qdet_user", name: "Test", email: "qdet@test.com" },
  }),
}));

import { GET } from "@/app/api/v1/questions/[id]/route";

let questionId: string;

beforeAll(async () => {
  const subject = await prisma.subject.findFirst();
  const institution = await prisma.institution.findFirst();

  const q = await prisma.question.create({
    data: {
      statement: "__test_qdet question",
      explanation: "This is the explanation.",
      difficulty: "MEDIUM",
      year: 2025,
      subjectId: subject!.id,
      institutionId: institution!.id,
      alternatives: {
        create: [
          { text: "Option A", isCorrect: true, position: 0 },
          { text: "Option B", isCorrect: false, position: 1 },
          { text: "Option C", isCorrect: false, position: 2 },
        ],
      },
    },
  });
  questionId = q.id;
});

afterAll(async () => {
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: "__test_qdet" } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: "__test_qdet" } },
  });
  await prisma.$disconnect();
});

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/v1/questions/${id}`);
}

describe("GET /api/v1/questions/[id]", () => {
  it("returns question detail", async () => {
    const res = await GET(makeRequest(questionId), {
      params: Promise.resolve({ id: questionId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(questionId);
    expect(body.statement).toBe("__test_qdet question");
    expect(body.difficulty).toBe("MEDIUM");
    expect(body.year).toBe(2025);
    expect(body.subject).toHaveProperty("name");
    expect(body.institution).toHaveProperty("name");
    expect(body.alternatives).toHaveLength(3);
  });

  it("does NOT expose isCorrect", async () => {
    const res = await GET(makeRequest(questionId), {
      params: Promise.resolve({ id: questionId }),
    });
    const body = await res.json();

    for (const alt of body.alternatives) {
      expect(alt).not.toHaveProperty("isCorrect");
    }
  });

  it("does NOT expose explanation before answering", async () => {
    const res = await GET(makeRequest(questionId), {
      params: Promise.resolve({ id: questionId }),
    });
    const body = await res.json();

    expect(body).not.toHaveProperty("explanation");
  });

  it("returns 404 for non-existent question", async () => {
    const res = await GET(makeRequest("nonexistent_id"), {
      params: Promise.resolve({ id: "nonexistent_id" }),
    });
    expect(res.status).toBe(404);
  });
});
