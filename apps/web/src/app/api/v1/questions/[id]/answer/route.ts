import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { answerBodySchema } from "@/lib/api/schemas/questions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id: questionId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = answerBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fields[key]) {
        fields[key] = issue.message;
      }
    }
    return Response.json({ error: "Dados inválidos.", fields }, { status: 400 });
  }

  const { alternativeId } = parsed.data;

  const question = await prisma.question.findUnique({
    where: { id: questionId, status: "ACTIVE" },
    select: {
      id: true,
      explanation: true,
      alternatives: { select: { id: true, isCorrect: true } },
    },
  });

  if (!question) {
    return Response.json(
      { error: "Questão não encontrada." },
      { status: 404 },
    );
  }

  const chosen = question.alternatives.find((a) => a.id === alternativeId);
  if (!chosen) {
    return Response.json(
      { error: "Alternativa não pertence a esta questão." },
      { status: 400 },
    );
  }

  const correct = question.alternatives.find((a) => a.isCorrect)!;

  await prisma.answerHistory.create({
    data: {
      userId: session.user.id,
      questionId,
      alternativeId,
      isCorrect: chosen.isCorrect,
      responseTime: 0,
    },
  });

  return Response.json({
    isCorrect: chosen.isCorrect,
    correctAlternativeId: correct.id,
    explanation: question.explanation,
  });
}
