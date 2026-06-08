import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { accuracyPercent } from "@/lib/stats/accuracy";
import { computeStreak } from "@/lib/stats/streak";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const userId = session.user.id;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const [allRows, weekRows] = await Promise.all([
    prisma.answerHistory.findMany({
      where: { userId },
      select: { isCorrect: true, createdAt: true },
    }),
    prisma.answerHistory.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      select: { isCorrect: true },
    }),
  ]);

  const totalAnswered = allRows.length;
  const totalCorrect = allRows.filter((r) => r.isCorrect).length;
  const accuracyAll = accuracyPercent(totalCorrect, totalAnswered);

  const totalAnsweredWeek = weekRows.length;
  const totalCorrectWeek = weekRows.filter((r) => r.isCorrect).length;
  const accuracyWeek = accuracyPercent(totalCorrectWeek, totalAnsweredWeek);

  const currentStreak = computeStreak(
    allRows.map((r) => r.createdAt),
    now,
  );

  return Response.json({
    totalAnswered,
    totalCorrect,
    accuracyAll,
    totalAnsweredWeek,
    accuracyWeek,
    currentStreak,
  });
}
