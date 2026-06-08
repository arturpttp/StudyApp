import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/flashcards/route";

const PREFIX = "__test_fc_list_";
const USER_ID = PREFIX + "user";
const OTHER_USER_ID = PREFIX + "other";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  await prisma.user.create({
    data: { id: OTHER_USER_ID, email: PREFIX + "other@test.com", name: "O" },
  });
  authMock.mockResolvedValue({
    user: { id: USER_ID, role: "STUDENT" },
  });
});

afterAll(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.topic.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

function req(url: string) {
  return new Request("http://test" + url);
}

describe("GET /api/v1/flashcards", () => {
  it("returns only the current user's cards", async () => {
    const now = new Date();
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "mine",
        back: "back",
        nextReview: now,
      },
    });
    await prisma.flashcard.create({
      data: {
        userId: OTHER_USER_ID,
        front: "theirs",
        back: "back",
        nextReview: now,
      },
    });

    const res = await GET(req("/api/v1/flashcards"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("mine");
  });

  it("filters by dueOnly=true", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 86400 * 1000);
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "due now", back: "b", nextReview: now },
    });
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "later", back: "b", nextReview: future },
    });

    const res = await GET(req("/api/v1/flashcards?dueOnly=true"));
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("due now");
  });

  it("filters by topicIds (any-match)", async () => {
    const topicA = await prisma.topic.create({
      data: { name: PREFIX + "A" },
    });
    const topicB = await prisma.topic.create({
      data: { name: PREFIX + "B" },
    });
    const now = new Date();
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "A only",
        back: "b",
        nextReview: now,
        topics: { connect: [{ id: topicA.id }] },
      },
    });
    await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "B only",
        back: "b",
        nextReview: now,
        topics: { connect: [{ id: topicB.id }] },
      },
    });
    await prisma.flashcard.create({
      data: { userId: USER_ID, front: "neither", back: "b", nextReview: now },
    });

    const res = await GET(req(`/api/v1/flashcards?topicIds=${topicA.id}`));
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].front).toBe("A only");
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req("/api/v1/flashcards"));
    expect(res.status).toBe(401);
  });
});
