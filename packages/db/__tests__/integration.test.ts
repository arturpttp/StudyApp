import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/index.js";

describe("database integration", () => {
  afterAll(async () => {
    // Clean up test data
    await prisma.subject.deleteMany({
      where: { name: { startsWith: "__test_" } },
    });
    await prisma.$disconnect();
  });

  it("can connect to PostgreSQL and perform CRUD on Subject", async () => {
    const testName = `__test_${Date.now()}`;

    // Create
    const created = await prisma.subject.create({
      data: { name: testName },
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe(testName);

    // Read
    const found = await prisma.subject.findUnique({
      where: { id: created.id },
    });
    expect(found).not.toBeNull();
    expect(found!.name).toBe(testName);

    // Delete
    await prisma.subject.delete({ where: { id: created.id } });
    const deleted = await prisma.subject.findUnique({
      where: { id: created.id },
    });
    expect(deleted).toBeNull();
  });
});
