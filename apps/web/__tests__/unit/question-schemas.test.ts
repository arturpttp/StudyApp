// apps/web/__tests__/unit/question-schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  questionsQuerySchema,
  randomQuerySchema,
  answerBodySchema,
} from "@/lib/api/schemas/questions";

describe("questionsQuerySchema", () => {
  it("parses valid query with all filters", () => {
    const result = questionsQuerySchema.safeParse({
      page: "2",
      limit: "10",
      subjectId: "sub1",
      institutionId: "inst1",
      difficulty: "EASY",
      year: "2024",
      unanswered: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
      expect(result.data.difficulty).toBe("EASY");
      expect(result.data.year).toBe(2024);
      expect(result.data.unanswered).toBe(true);
    }
  });

  it("applies defaults for page and limit", () => {
    const result = questionsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects invalid difficulty", () => {
    const result = questionsQuerySchema.safeParse({ difficulty: "IMPOSSIBLE" });
    expect(result.success).toBe(false);
  });

  it("rejects limit above 100", () => {
    const result = questionsQuerySchema.safeParse({ limit: "200" });
    expect(result.success).toBe(false);
  });
});

describe("randomQuerySchema", () => {
  it("parses empty query", () => {
    const result = randomQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses difficulty filter", () => {
    const result = randomQuerySchema.safeParse({ difficulty: "HARD" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difficulty).toBe("HARD");
    }
  });
});

describe("answerBodySchema", () => {
  it("parses valid alternativeId", () => {
    const result = answerBodySchema.safeParse({ alternativeId: "alt123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty alternativeId", () => {
    const result = answerBodySchema.safeParse({ alternativeId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing alternativeId", () => {
    const result = answerBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
