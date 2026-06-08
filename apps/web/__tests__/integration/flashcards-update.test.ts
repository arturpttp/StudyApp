import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET, PATCH, DELETE } from "@/app/api/v1/flashcards/[id]/route";

const PREFIX = "__test_fc_upd_";
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

async function makeCard(userId: string) {
  return prisma.flashcard.create({
    data: {
      userId,
      front: "f",
      back: "b",
      nextReview: new Date(),
    },
  });
}

function makeReq(method: string, body?: unknown): Request {
  return new Request("http://test", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/flashcards/[id]", () => {
  it("returns the card when owned by user", async () => {
    const card = await makeCard(USER_ID);
    const res = await GET(makeReq("GET"), ctx(card.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(card.id);
  });

  it("returns 404 when card belongs to another user", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await GET(makeReq("GET"), ctx(card.id));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/flashcards/[id]", () => {
  it("updates content without touching SR state", async () => {
    const card = await makeCard(USER_ID);
    const before = card.easeFactor;

    const res = await PATCH(
      makeReq("PATCH", { front: "novo front" }),
      ctx(card.id),
    );
    expect(res.status).toBe(204);

    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.front).toBe("novo front");
    expect(updated!.easeFactor).toBe(before);
    expect(updated!.repetitions).toBe(card.repetitions);
  });

  it("returns 404 for non-owner", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await PATCH(makeReq("PATCH", { front: "x" }), ctx(card.id));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/flashcards/[id]", () => {
  it("deletes the card", async () => {
    const card = await makeCard(USER_ID);
    const res = await DELETE(makeReq("DELETE"), ctx(card.id));
    expect(res.status).toBe(204);
    expect(
      await prisma.flashcard.findUnique({ where: { id: card.id } }),
    ).toBeNull();
  });

  it("returns 404 for non-owner", async () => {
    const card = await makeCard(OTHER_USER_ID);
    const res = await DELETE(makeReq("DELETE"), ctx(card.id));
    expect(res.status).toBe(404);
    expect(
      await prisma.flashcard.findUnique({ where: { id: card.id } }),
    ).not.toBeNull();
  });
});
