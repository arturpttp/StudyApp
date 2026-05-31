import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST } from "@/app/api/v1/admin/questions/route";

const TEST_PREFIX = "__test_admin_q_";
let institutionId = "";
let topicId = "";

beforeEach(async () => {
  await prisma.alternative.deleteMany({
    where: { question: { statement: { startsWith: TEST_PREFIX } } },
  });
  await prisma.question.deleteMany({
    where: { statement: { startsWith: TEST_PREFIX } },
  });
  await prisma.topic.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.institution.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });

  const inst = await prisma.institution.create({
    data: { name: TEST_PREFIX + "inst" },
  });
  institutionId = inst.id;
  const topic = await prisma.topic.create({
    data: { name: TEST_PREFIX + "topic" },
  });
  topicId = topic.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeReq(body: unknown): Request {
  return new Request("http://test/api/v1/admin/questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = () => ({
  statement: TEST_PREFIX + "Qual é a alternativa correta?",
  explanation: "Porque sim.",
  difficulty: "EASY" as const,
  institutionId,
  topicIds: [topicId],
  newTopicNames: [],
  alternatives: [
    { text: "Alfa", isCorrect: true, position: 0 },
    { text: "Beta", isCorrect: false, position: 1 },
    { text: "Gama", isCorrect: false, position: 2 },
    { text: "Delta", isCorrect: false, position: 3 },
  ],
});

describe("POST /api/v1/admin/questions", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is STUDENT", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "STUDENT" },
    });
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(403);
  });

  it("creates a question and returns 201 with id (ADMIN)", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(makeReq(baseBody()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();

    const created = await prisma.question.findUnique({
      where: { id: body.id },
      include: { topics: true, alternatives: true },
    });
    expect(created?.topics.map((t) => t.id)).toContain(topicId);
    expect(created?.alternatives.length).toBe(4);
    expect(created?.alternatives.find((a) => a.isCorrect)?.text).toBe("Alfa");
  });

  it("creates new topics on-the-fly (case-insensitive dedup)", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const newName = TEST_PREFIX + "Cardiologia Pediátrica";
    const res = await POST(
      makeReq({
        ...baseBody(),
        topicIds: [],
        newTopicNames: [newName, newName.toUpperCase()],
      }),
    );
    expect(res.status).toBe(201);
    const created = await prisma.question.findUnique({
      where: { id: (await res.json()).id },
      include: { topics: true },
    });
    expect(created?.topics.length).toBe(1);
  });

  it("returns 400 when alternatives are invalid", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({
        ...baseBody(),
        alternatives: [
          { text: "A", isCorrect: false, position: 0 },
          { text: "B", isCorrect: false, position: 1 },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no topics provided", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({ ...baseBody(), topicIds: [], newTopicNames: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when institutionId does not exist", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const res = await POST(
      makeReq({ ...baseBody(), institutionId: "nonexistent-id" }),
    );
    expect(res.status).toBe(404);
  });
});
