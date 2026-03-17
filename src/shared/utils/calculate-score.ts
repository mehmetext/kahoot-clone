export function calculateScore(
  answeredAt: number,
  questionStartedAt: number,
  timeLimit: number,
  isCorrect: boolean,
): number {
  if (!isCorrect) return 0;

  if (timeLimit <= 0) {
    return 0;
  }

  const elapsed = (answeredAt - questionStartedAt) / 1000;
  const ratio = elapsed / timeLimit;

  const maxScore = 1000;
  const minScore = 500;

  return Math.round(
    Math.min(
      maxScore,
      Math.max(minScore, maxScore - ratio * (maxScore - minScore)),
    ),
  );
}
