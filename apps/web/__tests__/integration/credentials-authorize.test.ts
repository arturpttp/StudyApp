import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@healthquest/db";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { hashPassword } from "@/lib/auth/password";

const EMAIL = `__test_authorize_${Date.now()}@example.com`;
const PASSWORD = "senha1234";

describe("authorizeCredentials", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: "Test Authorize",
        email: EMAIL,
        password: await hashPassword(PASSWORD),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: "__test_authorize_" } },
    });
    await prisma.$disconnect();
  });

  it("returns the user shape for correct email + password", async () => {
    const result = await authorizeCredentials({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      email: EMAIL,
      name: "Test Authorize",
    });
    expect(result).toHaveProperty("id");
  });

  it("returns null for non-existent user", async () => {
    const result = await authorizeCredentials({
      email: "__test_authorize_missing@example.com",
      password: PASSWORD,
    });
    expect(result).toBeNull();
  });

  it("returns null for wrong password", async () => {
    const result = await authorizeCredentials({
      email: EMAIL,
      password: "wrong9999",
    });
    expect(result).toBeNull();
  });

  it("returns null for schema-invalid input", async () => {
    const result = await authorizeCredentials({
      email: "not-an-email",
      password: "",
    });
    expect(result).toBeNull();
  });

  it("normalizes email case on lookup", async () => {
    const result = await authorizeCredentials({
      email: EMAIL.toUpperCase(),
      password: PASSWORD,
    });
    expect(result).not.toBeNull();
    expect(result?.email).toBe(EMAIL);
  });
});
