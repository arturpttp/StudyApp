import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

export async function GET(): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const exams = await prisma.exam.findMany({
    where: {
      userId: session.user.id,
      status: "FINISHED",
      score: { not: null },
      finishedAt: { not: null },
    },
    select: { id: true, score: true, finishedAt: true },
    orderBy: { finishedAt: "asc" },
  });

  if (exams.length === 0) {
    return Response.json({
      totalFinished: 0,
      avgScore: 0,
      bestScore: 0,
      scores: [],
    });
  }

  const scores = exams.map((e) => ({
    examId: e.id,
    date: e.finishedAt!.toISOString(),
    score: Math.round((e.score ?? 0) * 100),
  }));

  const total = scores.reduce((sum, s) => sum + s.score, 0);
  const avgScore = Math.round(total / scores.length);
  const bestScore = scores.reduce((best, s) => (s.score > best ? s.score : best), 0);

  return Response.json({
    totalFinished: scores.length,
    avgScore,
    bestScore,
    scores,
  });
}
