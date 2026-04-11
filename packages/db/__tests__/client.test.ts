import { describe, it, expect } from "vitest";
import { prisma } from "../src/index.js";

describe("@healthquest/db", () => {
  it("exports a PrismaClient instance", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe("object");
  });

  it("PrismaClient has expected model accessors", () => {
    expect(prisma.user).toBeDefined();
    expect(prisma.question).toBeDefined();
    expect(prisma.alternative).toBeDefined();
    expect(prisma.subject).toBeDefined();
    expect(prisma.institution).toBeDefined();
    expect(prisma.answerHistory).toBeDefined();
    expect(prisma.flashcard).toBeDefined();
    expect(prisma.exam).toBeDefined();
    expect(prisma.examQuestion).toBeDefined();
  });
});
