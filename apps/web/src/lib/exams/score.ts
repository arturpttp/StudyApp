export interface ScorableAnswer {
  selectedAlternativeId: string | null;
  correctAlternativeId: string;
}

export function calculateExamScore(answers: ScorableAnswer[]): number {
  if (answers.length === 0) return 0;
  const correct = answers.filter(
    (a) =>
      a.selectedAlternativeId !== null &&
      a.selectedAlternativeId === a.correctAlternativeId,
  ).length;
  return correct / answers.length;
}
