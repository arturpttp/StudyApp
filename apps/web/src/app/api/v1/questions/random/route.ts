import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { randomQuerySchema } from "@/lib/api/schemas/questions";

export async function GET(req: Request): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const rawParams = Object.fromEntries(url.searchParams);

  const parsed = randomQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (parsed.data.difficulty) where.difficulty = parsed.data.difficulty;

  const count = await prisma.question.count({ where });
  if (count === 0) {
    return Response.json(
      { error: "Nenhuma questão encontrada." },
      { status: 404 },
    );
  }

  const skip = Math.floor(Math.random() * count);
  const question = await prisma.question.findFirst({
    where,
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
    skip,
  });

  if (!question) {
    return Response.json(
      { error: "Nenhuma questão encontrada." },
      { status: 404 },
    );
  }

  return Response.json(question);
}
