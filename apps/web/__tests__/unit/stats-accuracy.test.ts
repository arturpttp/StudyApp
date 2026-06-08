import { describe, it, expect } from "vitest";
import { accuracyPercent } from "@/lib/stats/accuracy";

describe("accuracyPercent", () => {
  it("returns 0 when total is 0", () => {
    expect(accuracyPercent(0, 0)).toBe(0);
  });

  it("returns 100 for perfect score", () => {
    expect(accuracyPercent(10, 10)).toBe(100);
  });

  it("returns 70 for 7 of 10", () => {
    expect(accuracyPercent(7, 10)).toBe(70);
  });

  it("rounds to nearest integer (2 of 3 → 67)", () => {
    expect(accuracyPercent(2, 3)).toBe(67);
  });

  it("returns 0 for 0 correct of N", () => {
    expect(accuracyPercent(0, 5)).toBe(0);
  });
});
