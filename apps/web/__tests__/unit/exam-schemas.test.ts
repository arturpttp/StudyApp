import { describe, it, expect } from "vitest";
import {
  generateExamBodySchema,
  patchExamQuestionBodySchema,
} from "@/lib/api/schemas/exams";

describe("generateExamBodySchema", () => {
  it("accepts minimum valid body", () => {
    const result = generateExamBodySchema.safeParse({ count: 5 });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = generateExamBodySchema.safeParse({
      subjectId: "abc",
      difficulty: "EASY",
      count: 20,
      timeLimit: 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts timeLimit: null as no limit", () => {
    const result = generateExamBodySchema.safeParse({ count: 5, timeLimit: null });
    expect(result.success).toBe(true);
  });

  it("rejects count below 5", () => {
    expect(generateExamBodySchema.safeParse({ count: 4 }).success).toBe(false);
  });

  it("rejects count above 100", () => {
    expect(generateExamBodySchema.safeParse({ count: 101 }).success).toBe(false);
  });

  it("rejects timeLimit below 5", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, timeLimit: 4 }).success,
    ).toBe(false);
  });

  it("rejects timeLimit above 600", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, timeLimit: 601 }).success,
    ).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    expect(
      generateExamBodySchema.safeParse({ count: 10, difficulty: "EXPERT" }).success,
    ).toBe(false);
  });
});

describe("patchExamQuestionBodySchema", () => {
  it("accepts an alternativeId string", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: "abc" }).success,
    ).toBe(true);
  });

  it("accepts null to clear selection", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: null }).success,
    ).toBe(true);
  });

  it("rejects missing field", () => {
    expect(patchExamQuestionBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(
      patchExamQuestionBodySchema.safeParse({ alternativeId: "" }).success,
    ).toBe(false);
  });
});

describe("generateExamBodySchema — topics", () => {
  it("defaults topicIds to [] and topicMatchMode to 'any'", () => {
    const parsed = generateExamBodySchema.parse({ count: 5 });
    expect(parsed.topicIds).toEqual([]);
    expect(parsed.topicMatchMode).toBe("any");
  });

  it("accepts topicIds and topicMatchMode", () => {
    const parsed = generateExamBodySchema.parse({
      count: 5,
      topicIds: ["t1", "t2"],
      topicMatchMode: "all",
    });
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
    expect(parsed.topicMatchMode).toBe("all");
  });
});
