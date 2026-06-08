import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { PATCH } from "@/app/api/v1/flashcards/[id]/review/route";

const PREFIX = "__test_fc_review_";
const USER_ID = PREFIX + "user";

beforeEach(async () => {
  await prisma.flashcard.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

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
  await prisma.$disconnect();
});

async function newCard() {
  return prisma.flashcard.create({
    data: { userId: USER_ID, front: "f", back: "b", nextReview: new Date() },
  });
}

function makeReq(body: unknown): Request {
  return new Request("http://test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/v1/flashcards/[id]/review", () => {
  it("Fácil (5) advances reps to 1 and interval to 1", async () => {
    const card = await newCard();
    const res = await PATCH(makeReq({ rating: 5 }), ctx(card.id));
    expect(res.status).toBe(200);
    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.repetitions).toBe(1);
    expect(updated!.interval).toBe(1);
    expect(updated!.lastReview).not.toBeNull();
  });

  it("Errei (0) on a learned card resets reps to 0", async () => {
    const card = await prisma.flashcard.create({
      data: {
        userId: USER_ID,
        front: "f",
        back: "b",
        nextReview: new Date(),
        easeFactor: 2.7,
        interval: 14,
        repetitions: 4,
      },
    });
    const res = await PATCH(makeReq({ rating: 0 }), ctx(card.id));
    expect(res.status).toBe(200);
    const updated = await prisma.flashcard.findUnique({ where: { id: card.id } });
    expect(updated!.repetitions).toBe(0);
    expect(updated!.interval).toBe(1);
    expect(updated!.easeFactor).toBe(2.7);
  });

  it("returns 400 for invalid rating", async () => {
    const card = await newCard();
    const res = await PATCH(makeReq({ rating: 2 }), ctx(card.id));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owner card", async () => {
    const other = await prisma.user.create({
      data: { id: PREFIX + "other", email: PREFIX + "o@test.com", name: "O" },
    });
    const card = await prisma.flashcard.create({
      data: { userId: other.id, front: "f", back: "b", nextReview: new Date() },
    });
    const res = await PATCH(makeReq({ rating: 5 }), ctx(card.id));
    expect(res.status).toBe(404);
  });
});
