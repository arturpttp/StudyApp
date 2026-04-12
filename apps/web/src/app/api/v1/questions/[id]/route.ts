import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const question = await prisma.question.findUnique({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      statement: true,
      difficulty: true,
      year: true,
      subject: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true } },
      alternatives: {
        select: { id: true, text: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!question) {
    return Response.json(
      { error: "Questão não encontrada." },
      { status: 404 },
    );
  }

  return Response.json(question);
}
