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

  it("accepts optional responseTime", () => {
    const result = answerBodySchema.safeParse({
      alternativeId: "alt123",
      responseTime: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseTime).toBe(5000);
    }
  });

  it("defaults responseTime to 0 when omitted", () => {
    const result = answerBodySchema.safeParse({ alternativeId: "alt123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseTime).toBe(0);
    }
  });

  it("rejects negative responseTime", () => {
    const result = answerBodySchema.safeParse({
      alternativeId: "alt123",
      responseTime: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer responseTime", () => {
    const result = answerBodySchema.safeParse({
      alternativeId: "alt123",
      responseTime: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("questionsQuerySchema — topics", () => {
  it("defaults topicIds to [] and topicMatchMode to 'any'", () => {
    const parsed = questionsQuerySchema.parse({});
    expect(parsed.topicIds).toEqual([]);
    expect(parsed.topicMatchMode).toBe("any");
  });

  it("accepts a single topicId as string", () => {
    const parsed = questionsQuerySchema.parse({ topicIds: "t1" });
    expect(parsed.topicIds).toEqual(["t1"]);
  });

  it("accepts multiple topicIds as array", () => {
    const parsed = questionsQuerySchema.parse({ topicIds: ["t1", "t2"] });
    expect(parsed.topicIds).toEqual(["t1", "t2"]);
  });

  it("rejects invalid topicMatchMode", () => {
    const result = questionsQuerySchema.safeParse({ topicMatchMode: "both" });
    expect(result.success).toBe(false);
  });
});
