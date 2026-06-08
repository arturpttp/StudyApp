import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { reviewFlashcardBodySchema } from "@/lib/api/schemas/flashcards";
import { applySm2 } from "@/lib/flashcards/sm2";

type RouteContext = { params: Promise<{ id: string }> };

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

  const parsed = reviewFlashcardBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Rating inválido." },
      { status: 400 },
    );
  }

  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      easeFactor: true,
      interval: true,
      repetitions: true,
    },
  });
  if (!card) {
    return Response.json(
      { error: "Flashcard não encontrado." },
      { status: 404 },
    );
  }

  const next = applySm2(card, parsed.data.rating, new Date());

  const updated = await prisma.flashcard.update({
    where: { id },
    data: {
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      lastReview: next.lastReview,
      nextReview: next.nextReview,
    },
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

  return Response.json(updated);
}
