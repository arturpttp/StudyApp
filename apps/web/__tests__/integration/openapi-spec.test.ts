import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "__test_openapi_user", name: "Test", email: "openapi@test.com" },
  }),
}));

import { GET } from "@/app/api/v1/openapi.json/route";

describe("GET /api/v1/openapi.json", () => {
  it("returns a valid OpenAPI 3.1 document", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("HealthQuest API");
  });

  it("includes all question-domain paths", async () => {
    const res = await GET();
    const body = await res.json();
    const paths = Object.keys(body.paths);

    expect(paths).toContain("/api/v1/subjects");
    expect(paths).toContain("/api/v1/institutions");
    expect(paths).toContain("/api/v1/questions");
    expect(paths).toContain("/api/v1/questions/random");
    expect(paths).toContain("/api/v1/questions/{id}");
    expect(paths).toContain("/api/v1/questions/{id}/answer");
  });

  it("has Content-Type application/json", async () => {
    const res = await GET();

    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
