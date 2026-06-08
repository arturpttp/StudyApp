import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";
import { accuracyPercent } from "@/lib/stats/accuracy";

const MAX_TOPICS = 8;

export async function GET(): Promise<Response> {
  const { session, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const rows = await prisma.answerHistory.findMany({
    where: { userId: session.user.id },
    select: {
      isCorrect: true,
      question: {
        select: {
          topics: { select: { id: true, name: true } },
        },
      },
    },
  });

  const acc = new Map<string, { topicId: string; topicName: string; answered: number; correct: number }>();
  for (const row of rows) {
    for (const t of row.question.topics) {
      let bucket = acc.get(t.id);
      if (!bucket) {
        bucket = { topicId: t.id, topicName: t.name, answered: 0, correct: 0 };
        acc.set(t.id, bucket);
      }
      bucket.answered++;
      if (row.isCorrect) bucket.correct++;
    }
  }

  const result = Array.from(acc.values())
    .map((b) => ({
      topicId: b.topicId,
      topicName: b.topicName,
      answered: b.answered,
      correct: b.correct,
      accuracy: accuracyPercent(b.correct, b.answered),
    }))
    .sort((a, b) => {
      if (b.answered !== a.answered) return b.answered - a.answered;
      return a.topicName.localeCompare(b.topicName, "pt-BR");
    })
    .slice(0, MAX_TOPICS);

  return Response.json(result);
}
