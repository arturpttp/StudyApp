import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { patchExamQuestionBodySchema } from "@/lib/api/schemas/exams";

type RouteContext = {
  params: Promise<{ id: string; questionId: string }>;
};

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id: examId, questionId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = patchExamQuestionBodySchema.safeParse(body);
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

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId: session.user.id },
    select: { status: true },
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

  const examQuestion = await prisma.examQuestion.findUnique({
    where: { examId_questionId: { examId, questionId } },
    select: {
      question: {
        select: { alternatives: { select: { id: true } } },
      },
    },
  });
  if (!examQuestion) {
    return Response.json(
      { error: "Questão não pertence a este simulado." },
      { status: 404 },
    );
  }

  if (alternativeId !== null) {
    const belongs = examQuestion.question.alternatives.some(
      (a) => a.id === alternativeId,
    );
    if (!belongs) {
      return Response.json(
        { error: "Alternativa não pertence a esta questão." },
        { status: 400 },
      );
    }
  }

  await prisma.examQuestion.update({
    where: { examId_questionId: { examId, questionId } },
    data: { selectedAlternativeId: alternativeId },
  });

  return new Response(null, { status: 204 });
}
