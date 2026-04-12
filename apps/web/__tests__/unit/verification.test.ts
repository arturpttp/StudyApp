import { describe, it, expect } from "vitest";
import { generateVerificationToken } from "@/lib/auth/verification";

describe("generateVerificationToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateVerificationToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces unique values on each call", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });
});
