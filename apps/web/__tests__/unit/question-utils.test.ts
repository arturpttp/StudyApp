import { describe, it, expect } from "vitest";
import { formatTimer, positionToLetter } from "@/lib/question-utils";

describe("formatTimer", () => {
  it("formats 0ms as 00:00", () => {
    expect(formatTimer(0)).toBe("00:00");
  });

  it("formats 59 seconds", () => {
    expect(formatTimer(59_000)).toBe("00:59");
  });

  it("formats 1 minute exactly", () => {
    expect(formatTimer(60_000)).toBe("01:00");
  });

  it("formats 5 minutes 30 seconds", () => {
    expect(formatTimer(330_000)).toBe("05:30");
  });

  it("formats 99 minutes 59 seconds", () => {
    expect(formatTimer(5_999_000)).toBe("99:59");
  });

  it("ignores sub-second precision", () => {
    expect(formatTimer(61_999)).toBe("01:01");
  });
});

describe("positionToLetter", () => {
  it("maps 0 to A", () => {
    expect(positionToLetter(0)).toBe("A");
  });

  it("maps 1 to B", () => {
    expect(positionToLetter(1)).toBe("B");
  });

  it("maps 4 to E", () => {
    expect(positionToLetter(4)).toBe("E");
  });
});
