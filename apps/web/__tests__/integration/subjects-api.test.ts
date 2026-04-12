import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@healthquest/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_subjects_user", name: "Test", email: "test@test.com" },
  }),
}));

import { GET } from "@/app/api/v1/subjects/route";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/subjects", () => {
  it("returns all subjects sorted by name", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 1) {
      const names = body.map((s: { name: string }) => s.name);
      const sorted = [...names].sort((a: string, b: string) =>
        a.localeCompare(b, "pt-BR"),
      );
      expect(names).toEqual(sorted);
    }
  });

  it("returns id and name for each subject", async () => {
    const res = await GET();
    const body = await res.json();

    if (body.length > 0) {
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("name");
      expect(Object.keys(body[0])).toEqual(["id", "name"]);
    }
  });
});
