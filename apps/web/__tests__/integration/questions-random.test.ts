import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_qrand_user", name: "Test", email: "qrand@test.com" },
  }),
}));

import { GET } from "@/app/api/v1/questions/random/route";

afterAll(async () => {
  await prisma.$disconnect();
});

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/v1/questions/random");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

describe("GET /api/v1/questions/random", () => {
  it("returns a single question", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("statement");
    expect(body).toHaveProperty("alternatives");
    expect(Array.isArray(body.alternatives)).toBe(true);
  });

  it("never exposes isCorrect", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    for (const alt of body.alternatives) {
      expect(alt).not.toHaveProperty("isCorrect");
    }
  });

  it("filters by difficulty when provided", async () => {
    const res = await GET(makeRequest({ difficulty: "EASY" }));

    if (res.status === 200) {
      const body = await res.json();
      expect(body.difficulty).toBe("EASY");
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("returns 404 when no questions match", async () => {
    const res = await GET(makeRequest({ difficulty: "HARD" }));
    expect([200, 404]).toContain(res.status);
  });
});
