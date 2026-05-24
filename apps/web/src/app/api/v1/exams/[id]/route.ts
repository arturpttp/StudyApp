import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      score: true,
      timeLimit: true,
      createdAt: true,
      finishedAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
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

  const isFinished = exam.status === "FINISHED";

  const questions = exam.questions.map((eq) => {
    const base = {
      questionId: eq.question.id,
      order: eq.order,
      statement: eq.question.statement,
      alternatives: eq.question.alternatives.map((a) => ({
        id: a.id,
        text: a.text,
        position: a.position,
      })),
      selectedAlternativeId: eq.selectedAlternativeId,
    };

    if (!isFinished) return base;

    const correct = eq.question.alternatives.find((a) => a.isCorrect);
    return {
      ...base,
      explanation: eq.question.explanation,
      correctAlternativeId: correct!.id,
      isCorrect:
        eq.selectedAlternativeId !== null &&
        eq.selectedAlternativeId === correct!.id,
    };
  });

  return Response.json({
    id: exam.id,
    status: exam.status,
    timeLimit: exam.timeLimit,
    createdAt: exam.createdAt,
    ...(isFinished && { score: exam.score, finishedAt: exam.finishedAt }),
    questions,
  });
}
