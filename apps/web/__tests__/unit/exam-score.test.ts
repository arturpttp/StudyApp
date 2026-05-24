import { describe, it, expect } from "vitest";
import { calculateExamScore } from "@/lib/exams/score";

describe("calculateExamScore", () => {
  it("returns 1.0 when all answers are correct", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(1);
  });

  it("returns 0.0 when all answers are wrong", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "b1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "b2" },
    ]);
    expect(result).toBe(0);
  });

  it("returns partial score for mixed answers", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: "a2", correctAlternativeId: "b2" },
      { selectedAlternativeId: "a3", correctAlternativeId: "a3" },
      { selectedAlternativeId: "a4", correctAlternativeId: "b4" },
    ]);
    expect(result).toBe(0.5);
  });

  it("counts null (unanswered) as wrong", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: "a1", correctAlternativeId: "a1" },
      { selectedAlternativeId: null, correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(0.5);
  });

  it("returns 0.0 when all unanswered", () => {
    const result = calculateExamScore([
      { selectedAlternativeId: null, correctAlternativeId: "a1" },
      { selectedAlternativeId: null, correctAlternativeId: "a2" },
    ]);
    expect(result).toBe(0);
  });
});
