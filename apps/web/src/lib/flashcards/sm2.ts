export type Sm2State = {
  easeFactor: number;
  interval: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & {
  lastReview: Date;
  nextReview: Date;
};

export type Rating = 0 | 3 | 4 | 5;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function applySm2(prev: Sm2State, q: Rating, now: Date): Sm2Result {
  let easeFactor = prev.easeFactor;
  let interval: number;
  let repetitions: number;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = prev.repetitions + 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(prev.interval * prev.easeFactor);
    easeFactor = Math.max(
      1.3,
      prev.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
    );
  }

  return {
    easeFactor,
    interval,
    repetitions,
    lastReview: now,
    nextReview: addDays(now, interval),
  };
}
