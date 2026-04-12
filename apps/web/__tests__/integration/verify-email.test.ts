import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@healthquest/db";
import {
  createVerificationToken,
  consumeVerificationToken,
} from "@/lib/auth/verification";

describe("verification token flow", () => {
  const testEmail = "__test_verify@example.com";

  afterEach(async () => {
    await prisma.verificationToken.deleteMany({
      where: { identifier: { startsWith: "__test_" } },
    });
  });

  it("creates and consumes a valid token", async () => {
    const { token } = await createVerificationToken(testEmail);
    const result = await consumeVerificationToken(testEmail, token);
    expect(result).toBe(true);

    const remaining = await prisma.verificationToken.findMany({
      where: { identifier: testEmail },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns false for a wrong token", async () => {
    await createVerificationToken(testEmail);
    const result = await consumeVerificationToken(testEmail, "wrong-token");
    expect(result).toBe(false);
  });

  it("returns false for an expired token", async () => {
    const token = "expired-test-token-0123456789abcdef0123456789abcdef";
    await prisma.verificationToken.create({
      data: {
        identifier: testEmail,
        token,
        expires: new Date(Date.now() - 1000),
      },
    });

    const result = await consumeVerificationToken(testEmail, token);
    expect(result).toBe(false);
  });

  it("returns false when consuming a token twice", async () => {
    const { token } = await createVerificationToken(testEmail);
    await consumeVerificationToken(testEmail, token);
    const result = await consumeVerificationToken(testEmail, token);
    expect(result).toBe(false);
  });

  it("deletes stale tokens when creating a new one", async () => {
    await createVerificationToken(testEmail);
    await createVerificationToken(testEmail);

    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: testEmail },
    });
    expect(tokens).toHaveLength(1);
  });
});
