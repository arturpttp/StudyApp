import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { prisma } from "@healthquest/db";
import { POST } from "@/app/api/auth/register/route";
import { verifyPassword } from "@/lib/auth/password";

vi.mock("@/lib/email/resend", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/auth/verification", () => ({
  createVerificationToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = () => ({
  name: "Test Register",
  email: `__test_register_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`,
  password: "senha1234",
  confirmPassword: "senha1234",
});

describe("POST /api/auth/register", () => {
  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: "__test_register_" } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a user and returns 201 with the public shape", async () => {
    const body = validBody();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({ name: body.name, email: body.email });
    expect(json).toHaveProperty("id");
    expect(json).not.toHaveProperty("password");
  });

  it("stores a bcrypt hash, not the plaintext, and the hash verifies", async () => {
    const body = validBody();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    expect(user).not.toBeNull();
    expect(user!.password).not.toBe(body.password);
    await expect(verifyPassword(body.password, user!.password)).resolves.toBe(
      true,
    );
  });

  it("normalizes email to lowercase on insert", async () => {
    const body = validBody();
    body.email = body.email.toUpperCase();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
    const lower = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: lower } });
    expect(user).not.toBeNull();
  });

  it("returns 409 on duplicate email", async () => {
    const body = validBody();
    await POST(makeRequest(body));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("E-mail já cadastrado.");
  });

  it("returns 400 with field errors on invalid input", async () => {
    const res = await POST(
      makeRequest({
        name: "",
        email: "not-an-email",
        password: "short",
        confirmPassword: "different",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Dados inválidos.");
    expect(json.fields).toBeDefined();
    expect(json.fields.email).toBeDefined();
    expect(json.fields.password).toBeDefined();
  });

  it("returns 400 on malformed JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
