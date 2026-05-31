import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { requireAdmin } from "@/lib/api/require-admin";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

describe("requireAdmin", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const { session, errorResponse } = await requireAdmin();
    expect(session).toBeNull();
    expect(errorResponse?.status).toBe(401);
  });

  it("returns 403 when role is STUDENT", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "STUDENT" },
    } as any);
    const { session, errorResponse } = await requireAdmin();
    expect(session).toBeNull();
    expect(errorResponse?.status).toBe(403);
  });

  it("returns the session when role is ADMIN", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    } as any);
    const { session, errorResponse } = await requireAdmin();
    expect(errorResponse).toBeNull();
    expect(session?.user.role).toBe("ADMIN");
  });
});
