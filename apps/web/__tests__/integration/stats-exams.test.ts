import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET } from "@/app/api/v1/stats/exams/route";

const PREFIX = "__test_stats_ex_";
const USER_ID = PREFIX + "user";
const OTHER_USER_ID = PREFIX + "other";

beforeEach(async () => {
  await prisma.examQuestion.deleteMany({
    where: { exam: { user: { email: { startsWith: PREFIX } } } },
  });
  await prisma.exam.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

  await prisma.user.create({
    data: { id: USER_ID, email: PREFIX + "u@test.com", name: "U" },
  });
  await prisma.user.create({
    data: { id: OTHER_USER_ID, email: PREFIX + "other@test.com", name: "O" },
  });
  authMock.mockResolvedValue({ user: { id: USER_ID, role: "STUDENT" } });
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({
    where: { exam: { user: { email: { startsWith: PREFIX } } } },
  });
  await prisma.exam.deleteMany({
    where: { user: { email: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

async function makeExam(opts: {
  userId: string;
  status: "IN_PROGRESS" | "FINISHED";
  score?: number | null;
  finishedAt?: Date | null;
}) {
  return prisma.exam.create({
    data: {
      userId: opts.userId,
      status: opts.status,
      score: opts.score ?? null,
      finishedAt: opts.finishedAt ?? null,
    },
  });
}

describe("GET /api/v1/stats/exams", () => {
  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns zeroes and empty scores for a user with no finished exams", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.totalFinished).toBe(0);
    expect(body.avgScore).toBe(0);
    expect(body.bestScore).toBe(0);
    expect(body.scores).toEqual([]);
  });

  it("ignores IN_PROGRESS exams and those with null score", async () => {
    await makeExam({ userId: USER_ID, status: "IN_PROGRESS" });
    await makeExam({
      userId: USER_ID,
      status: "FINISHED",
      score: null,
      finishedAt: new Date(),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.totalFinished).toBe(0);
  });

  it("aggregates KPIs from finished exams", async () => {
    const t0 = new Date("2026-06-01T10:00:00.000Z");
    const t1 = new Date("2026-06-02T10:00:00.000Z");
    const t2 = new Date("2026-06-03T10:00:00.000Z");
    await makeExam({ userId: USER_ID, status: "FINISHED", score: 0.6, finishedAt: t0 });
    await makeExam({ userId: USER_ID, status: "FINISHED", score: 0.8, finishedAt: t1 });
    await makeExam({ userId: USER_ID, status: "FINISHED", score: 1.0, finishedAt: t2 });

    const res = await GET();
    const body = await res.json();
    expect(body.totalFinished).toBe(3);
    expect(body.avgScore).toBe(80);
    expect(body.bestScore).toBe(100);
    expect(body.scores).toHaveLength(3);
    expect(body.scores[0].score).toBe(60);
    expect(body.scores[2].score).toBe(100);
  });

  it("returns scores in ascending date order", async () => {
    const old = new Date("2026-05-01T10:00:00.000Z");
    const newer = new Date("2026-06-01T10:00:00.000Z");
    await makeExam({ userId: USER_ID, status: "FINISHED", score: 0.5, finishedAt: newer });
    await makeExam({ userId: USER_ID, status: "FINISHED", score: 0.9, finishedAt: old });

    const res = await GET();
    const body = await res.json();
    expect(new Date(body.scores[0].date).getTime()).toBeLessThan(
      new Date(body.scores[1].date).getTime(),
    );
  });

  it("does not include another user's exams", async () => {
    await makeExam({
      userId: OTHER_USER_ID,
      status: "FINISHED",
      score: 0.9,
      finishedAt: new Date(),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.totalFinished).toBe(0);
  });
});
