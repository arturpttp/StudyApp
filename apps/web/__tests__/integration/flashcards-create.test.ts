import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST } from "@/app/api/v1/flashcards/route";

const PREFIX = "__test_fc_create_";
const USER_ID = PREFIX + "user";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

function makeReq(body: unknown): Request {
  return new Request("http://test/api/v1/flashcards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/flashcards", () => {
  it("creates a card with nextReview=now", async () => {
    const before = Date.now();
    const res = await POST(
      makeReq({ front: "Q?", back: "A!" }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const card = await prisma.flashcard.findUnique({ where: { id } });
    expect(card).not.toBeNull();
    expect(card!.front).toBe("Q?");
    expect(card!.back).toBe("A!");
    expect(card!.userId).toBe(USER_ID);
    expect(card!.easeFactor).toBe(2.5);
    expect(card!.interval).toBe(0);
    expect(card!.repetitions).toBe(0);
    expect(card!.lastReview).toBeNull();
    expect(card!.nextReview.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("links topics when provided", async () => {
    const topic = await prisma.topic.create({
      data: { name: PREFIX + "topic" },
    });
    const res = await POST(
      makeReq({ front: "Q", back: "A", topicIds: [topic.id] }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const card = await prisma.flashcard.findUnique({
      where: { id },
      include: { topics: true },
    });
    expect(card!.topics.map((t) => t.id)).toContain(topic.id);
  });

  it("returns 404 when questionId does not exist", async () => {
    const res = await POST(
      makeReq({ front: "Q", back: "A", questionId: "does-not-exist" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when front is empty", async () => {
    const res = await POST(makeReq({ front: "", back: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq({ front: "Q", back: "A" }));
    expect(res.status).toBe(401);
  });
});
