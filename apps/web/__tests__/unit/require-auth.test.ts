import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { requireAuth } from "@/lib/api/require-auth";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

describe("requireAuth", () => {
  it("returns session when authenticated", async () => {
    const session = { user: { id: "user1", name: "Test", email: "t@t.com" } };
    mockAuth.mockResolvedValue(session as any);

    const result = await requireAuth();
    expect(result).toEqual({
      session,
      errorResponse: null,
    });
  });

  it("returns 401 Response when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAuth();
    expect(result.session).toBeNull();
    expect(result.errorResponse).toBeInstanceOf(Response);

    const body = await result.errorResponse!.json();
    expect(result.errorResponse!.status).toBe(401);
    expect(body.error).toBe("Não autenticado.");
  });
});
