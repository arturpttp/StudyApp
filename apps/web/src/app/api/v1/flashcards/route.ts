import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import {
  flashcardsQuerySchema,
  createFlashcardBodySchema,
} from "@/lib/api/schemas/flashcards";

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

  const parsed = flashcardsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const { dueOnly, topicIds: ids } = parsed.data;

  const where: Record<string, unknown> = { userId: session.user.id };
  if (dueOnly) where.nextReview = { lte: new Date() };
  if (ids.length > 0) where.topics = { some: { id: { in: ids } } };

  const cards = await prisma.flashcard.findMany({
    where,
    select: {
      id: true,
      front: true,
      back: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
      lastReview: true,
      nextReview: true,
      questionId: true,
      createdAt: true,
      topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
    orderBy: { nextReview: "asc" },
  });

  return Response.json(cards);
}

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

  const parsed = createFlashcardBodySchema.safeParse(body);
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

  const data = parsed.data;

  if (data.questionId) {
    const q = await prisma.question.findUnique({
      where: { id: data.questionId },
      select: { id: true },
    });
    if (!q) {
      return Response.json(
        { error: "Questão não encontrada." },
        { status: 404 },
      );
    }
  }

  const card = await prisma.flashcard.create({
    data: {
      userId: session.user.id,
      front: data.front,
      back: data.back,
      nextReview: new Date(),
      questionId: data.questionId ?? null,
      topics: { connect: data.topicIds.map((id) => ({ id })) },
    },
    select: { id: true },
  });

  return Response.json({ id: card.id }, { status: 201 });
}
