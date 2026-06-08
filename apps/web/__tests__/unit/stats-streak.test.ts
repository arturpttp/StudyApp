import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/stats/streak";

const NOW = new Date("2026-06-08T15:30:00.000Z");

function daysAgo(n: number, hour = 12): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

describe("computeStreak", () => {
  it("returns 0 for empty list", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("returns 1 when only today has activity", () => {
    expect(computeStreak([daysAgo(0)], NOW)).toBe(1);
  });

  it("returns 0 when most recent activity was yesterday only", () => {
    expect(computeStreak([daysAgo(1)], NOW)).toBe(0);
  });

  it("returns 2 for today + yesterday", () => {
    expect(computeStreak([daysAgo(0), daysAgo(1)], NOW)).toBe(2);
  });

  it("breaks streak on gap (today + 2 days ago → 1)", () => {
    expect(computeStreak([daysAgo(0), daysAgo(2)], NOW)).toBe(1);
  });

  it("multiple timestamps same day still count as 1 day", () => {
    expect(
      computeStreak([daysAgo(0, 9), daysAgo(0, 14), daysAgo(0, 22)], NOW),
    ).toBe(1);
  });

  it("counts 7 consecutive days", () => {
    const dates = [0, 1, 2, 3, 4, 5, 6].map((n) => daysAgo(n));
    expect(computeStreak(dates, NOW)).toBe(7);
  });

  it("ignores out-of-order input", () => {
    expect(computeStreak([daysAgo(2), daysAgo(0), daysAgo(1)], NOW)).toBe(3);
  });
});
