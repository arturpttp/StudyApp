import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { calculateExamScore } from "@/lib/exams/score";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id: examId } = await ctx.params;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId: session.user.id },
    select: {
      id: true,
      status: true,
      timeLimit: true,
      createdAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
          questionId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              alternatives: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  text: true,
                  position: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    return Response.json({ error: "Simulado não encontrado." }, { status: 404 });
  }
  if (exam.status === "FINISHED") {
    return Response.json(
      { error: "Simulado já foi finalizado." },
      { status: 409 },
    );
  }

  const scoreInputs = exam.questions.map((eq) => {
    const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
    return {
      selectedAlternativeId: eq.selectedAlternativeId,
      correctAlternativeId: correct.id,
    };
  });
  const score = calculateExamScore(scoreInputs);

  const historyRows = exam.questions
    .filter((eq) => eq.selectedAlternativeId !== null)
    .map((eq) => {
      const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
      return {
        userId: session.user.id,
        questionId: eq.questionId,
        alternativeId: eq.selectedAlternativeId!,
        isCorrect: eq.selectedAlternativeId === correct.id,
        responseTime: 0,
      };
    });

  const finishedAt = new Date();

  await prisma.$transaction([
    ...historyRows.map((row) => prisma.answerHistory.create({ data: row })),
    prisma.exam.update({
      where: { id: examId },
      data: { status: "FINISHED", score, finishedAt },
    }),
  ]);

  const questions = exam.questions.map((eq) => {
    const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
    return {
      questionId: eq.question.id,
      order: eq.order,
      statement: eq.question.statement,
      explanation: eq.question.explanation,
      alternatives: eq.question.alternatives.map((a) => ({
        id: a.id,
        text: a.text,
        position: a.position,
      })),
      selectedAlternativeId: eq.selectedAlternativeId,
      correctAlternativeId: correct.id,
      isCorrect:
        eq.selectedAlternativeId !== null &&
        eq.selectedAlternativeId === correct.id,
    };
  });

  return Response.json({
    id: exam.id,
    status: "FINISHED",
    score,
    timeLimit: exam.timeLimit,
    createdAt: exam.createdAt,
    finishedAt,
    questions,
  });
}
