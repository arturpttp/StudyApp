import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { generateExamBodySchema } from "@/lib/api/schemas/exams";

export async function POST(req: Request): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = generateExamBodySchema.safeParse(body);
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

  const { subjectId, difficulty, count, timeLimit } = parsed.data;

  const candidates = await prisma.question.findMany({
    where: {
      status: "ACTIVE",
      ...(subjectId && { subjectId }),
      ...(difficulty && { difficulty }),
    },
    select: { id: true },
  });

  if (candidates.length < count) {
    return Response.json(
      { error: "Não há questões suficientes para os filtros escolhidos." },
      { status: 422 },
    );
  }

  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, count);

  const exam = await prisma.exam.create({
    data: {
      userId: session.user.id,
      timeLimit: timeLimit ?? null,
      questions: {
        create: picked.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
    },
    select: { id: true },
  });

  return Response.json({ id: exam.id }, { status: 201 });
}
