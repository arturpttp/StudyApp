import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_topics_user", role: "STUDENT", name: "T", email: "t@t.com" },
  }),
}));

import { GET } from "@/app/api/v1/topics/route";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/topics", () => {
  it("returns all topics sorted by name", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const names = body.map((t: { name: string }) => t.name);
    const sorted = [...names].sort((a: string, b: string) =>
      a.localeCompare(b, "pt-BR"),
    );
    expect(names).toEqual(sorted);
  });

  it("returns only id and name for each topic", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body[0])).toEqual(["id", "name"]);
  });
});
