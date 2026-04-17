import { prisma } from "@healthquest/db";

export interface PreviousAnswer {
  alternativeId: string;
  isCorrect: boolean;
  correctAlternativeId: string;
  explanation: string | null;
}

export async function getPreviousAnswer(params: {
  userId: string;
  questionId: string;
}): Promise<PreviousAnswer | null> {
  const latest = await prisma.answerHistory.findFirst({
    where: { userId: params.userId, questionId: params.questionId },
    orderBy: { createdAt: "desc" },
    select: { alternativeId: true, isCorrect: true },
  });

  if (!latest) return null;

  const question = await prisma.question.findUnique({
    where: { id: params.questionId },
    select: {
      explanation: true,
      alternatives: {
        where: { isCorrect: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!question || question.alternatives.length === 0) return null;

  return {
    alternativeId: latest.alternativeId,
    isCorrect: latest.isCorrect,
    correctAlternativeId: question.alternatives[0].id,
    explanation: question.explanation,
  };
}
