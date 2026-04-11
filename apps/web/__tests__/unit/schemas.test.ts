import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/auth/schemas";

const validRegister = {
  name: "Ana Médica",
  email: "ana@example.com",
  password: "senha1234",
  confirmPassword: "senha1234",
};

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      password: "senha12",
      confirmPassword: "senha12",
    });
    expect(r.success).toBe(false);
  });

  it("rejects password missing a letter", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(r.success).toBe(false);
  });

  it("rejects password missing a digit", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      password: "senhasenha",
      confirmPassword: "senhasenha",
    });
    expect(r.success).toBe(false);
  });

  it("rejects mismatched confirmPassword and reports the field", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      confirmPassword: "outra1234",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const hasConfirmError = r.error.issues.some((i) =>
        i.path.includes("confirmPassword"),
      );
      expect(hasConfirmError).toBe(true);
    }
  });

  it("rejects invalid email", () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty name after trim", () => {
    const r = registerSchema.safeParse({ ...validRegister, name: "   " });
    expect(r.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const r = loginSchema.safeParse({
      email: "ana@example.com",
      password: "anything",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({
      email: "nope",
      password: "anything",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty password", () => {
    const r = loginSchema.safeParse({
      email: "ana@example.com",
      password: "",
    });
    expect(r.success).toBe(false);
  });
});
