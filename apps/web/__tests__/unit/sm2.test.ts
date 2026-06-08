import { describe, it, expect } from "vitest";
import { applySm2 } from "@/lib/flashcards/sm2";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const NEW_CARD = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
};

function days(n: number) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

describe("applySm2", () => {
  it("new card rated Fácil (5) → reps=1, interval=1, EF up", () => {
    const next = applySm2(NEW_CARD, 5, NOW);
    expect(next.repetitions).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBeCloseTo(2.6, 5);
    expect(next.nextReview).toEqual(days(1));
    expect(next.lastReview).toEqual(NOW);
  });

  it("second consecutive correct → interval=6", () => {
    const first = applySm2(NEW_CARD, 4, NOW);
    const second = applySm2(first, 4, NOW);
    expect(second.repetitions).toBe(2);
    expect(second.interval).toBe(6);
  });

  it("third+ consecutive correct → interval = round(prev.interval * EF)", () => {
    let card = applySm2(NEW_CARD, 4, NOW);
    card = applySm2(card, 4, NOW);
    const third = applySm2(card, 4, NOW);
    expect(third.repetitions).toBe(3);
    expect(third.interval).toBe(Math.round(card.interval * card.easeFactor));
  });

  it("Errei (q=0) resets reps to 0 and interval to 1, EF unchanged", () => {
    const card = { easeFactor: 2.8, interval: 30, repetitions: 4 };
    const next = applySm2(card, 0, NOW);
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBe(2.8);
    expect(next.nextReview).toEqual(days(1));
  });

  it("EF floors at 1.3 even after many low ratings", () => {
    let card = { easeFactor: 1.4, interval: 1, repetitions: 1 };
    for (let i = 0; i < 10; i++) card = applySm2(card, 3, NOW);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("rating Médio (4) leaves EF unchanged", () => {
    const next = applySm2(NEW_CARD, 4, NOW);
    expect(next.easeFactor).toBeCloseTo(2.5, 5);
  });

  it("rating Difícil (3) lowers EF", () => {
    const next = applySm2({ ...NEW_CARD }, 3, NOW);
    expect(next.easeFactor).toBeLessThan(2.5);
    expect(next.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
