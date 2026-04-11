import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers", () => {
  it("hashes a plaintext to a string different from the input", async () => {
    const hash = await hashPassword("hunter2-abc");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("hunter2-abc");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("produces different hashes for the same input (salted)", async () => {
    const a = await hashPassword("hunter2-abc");
    const b = await hashPassword("hunter2-abc");
    expect(a).not.toBe(b);
  });

  it("verifyPassword returns true for a matching pair", async () => {
    const hash = await hashPassword("hunter2-abc");
    await expect(verifyPassword("hunter2-abc", hash)).resolves.toBe(true);
  });

  it("verifyPassword returns false for a non-matching pair", async () => {
    const hash = await hashPassword("hunter2-abc");
    await expect(verifyPassword("wrong-pass-9", hash)).resolves.toBe(false);
  });
});
