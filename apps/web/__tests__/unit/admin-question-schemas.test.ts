import { describe, it, expect } from "vitest";
import { createAdminQuestionBodySchema } from "@/lib/api/schemas/admin-questions";

const validBody = {
  statement: "Qual é a capital do Brasil?",
  difficulty: "EASY" as const,
  institutionId: "inst1",
  topicIds: ["t1"],
  newTopicNames: [],
  alternatives: [
    { text: "Brasília", isCorrect: true, position: 0 },
    { text: "Rio de Janeiro", isCorrect: false, position: 1 },
    { text: "São Paulo", isCorrect: false, position: 2 },
    { text: "Salvador", isCorrect: false, position: 3 },
  ],
};

describe("createAdminQuestionBodySchema", () => {
  it("accepts a valid body", () => {
    const result = createAdminQuestionBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("rejects when both topicIds and newTopicNames are empty", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      topicIds: [],
      newTopicNames: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts when only newTopicNames provided", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      topicIds: [],
      newTopicNames: ["Nova Matéria"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when no alternative is correct", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: validBody.alternatives.map((a) => ({
        ...a,
        isCorrect: false,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects when more than one alternative is correct", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [
        { text: "A", isCorrect: true, position: 0 },
        { text: "B", isCorrect: true, position: 1 },
        { text: "C", isCorrect: false, position: 2 },
        { text: "D", isCorrect: false, position: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicated alternative positions", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [
        { text: "A", isCorrect: true, position: 0 },
        { text: "B", isCorrect: false, position: 0 },
        { text: "C", isCorrect: false, position: 2 },
        { text: "D", isCorrect: false, position: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 alternatives", () => {
    const result = createAdminQuestionBodySchema.safeParse({
      ...validBody,
      alternatives: [{ text: "A", isCorrect: true, position: 0 }],
    });
    expect(result.success).toBe(false);
  });
});
