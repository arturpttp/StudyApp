import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { updateFlashcardBodySchema } from "@/lib/api/schemas/flashcards";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
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
  });

  if (!card) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  return Response.json(card);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = updateFlashcardBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const owned = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  const data = parsed.data;
  await prisma.flashcard.update({
    where: { id },
    data: {
      ...(data.front !== undefined && { front: data.front }),
      ...(data.back !== undefined && { back: data.back }),
      ...(data.topicIds !== undefined && {
        topics: { set: data.topicIds.map((tid) => ({ id: tid })) },
      }),
    },
  });

  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { id } = await ctx.params;

  const owned = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  await prisma.flashcard.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
