import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { questionsQuerySchema } from "@/lib/api/schemas/questions";

export async function GET(req: Request): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const topicIds = url.searchParams.getAll("topicIds");
  const rawParams: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "topicIds") continue;
    rawParams[key] = value;
  }
  if (topicIds.length > 0) rawParams.topicIds = topicIds;

  const parsed = questionsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const {
    page,
    limit,
    subjectId,
    institutionId,
    difficulty,
    year,
    unanswered,
    topicIds: ids,
    topicMatchMode,
  } = parsed.data;

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (subjectId) where.subjectId = subjectId;
  if (institutionId) where.institutionId = institutionId;
  if (difficulty) where.difficulty = difficulty;
  if (year) where.year = year;
  if (unanswered) where.answers = { none: { userId: session.user.id } };

  if (ids.length > 0) {
    if (topicMatchMode === "all") {
      where.AND = ids.map((id) => ({ topics: { some: { id } } }));
    } else {
      where.topics = { some: { id: { in: ids } } };
    }
  }

  const [data, total] = await Promise.all([
    prisma.question.findMany({
      where,
      select: {
        id: true,
        statement: true,
        difficulty: true,
        year: true,
        subject: { select: { id: true, name: true } },
        institution: { select: { id: true, name: true } },
        topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        alternatives: {
          select: { id: true, text: true, position: true },
          orderBy: { position: "asc" },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: "asc" },
    }),
    prisma.question.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}
