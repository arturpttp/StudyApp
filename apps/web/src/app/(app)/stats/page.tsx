import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { accuracyPercent } from "@/lib/stats/accuracy";
import { computeStreak } from "@/lib/stats/streak";
import { KpiCard } from "@/components/stats/KpiCard";
import { TopicRadar } from "@/components/stats/TopicRadar";
import { TopicAccuracyList } from "@/components/stats/TopicAccuracyList";
import { ExamScoreLine } from "@/components/stats/ExamScoreLine";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOPICS = 8;

async function loadOverview(userId: string) {
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
  const totalAnsweredWeek = weekRows.length;
  const totalCorrectWeek = weekRows.filter((r) => r.isCorrect).length;

  return {
    totalAnswered,
    accuracyAll: accuracyPercent(totalCorrect, totalAnswered),
    totalAnsweredWeek,
    accuracyWeek: accuracyPercent(totalCorrectWeek, totalAnsweredWeek),
    currentStreak: computeStreak(allRows.map((r) => r.createdAt), now),
  };
}

async function loadByTopic(userId: string) {
  const rows = await prisma.answerHistory.findMany({
    where: { userId },
    select: {
      isCorrect: true,
      question: { select: { topics: { select: { id: true, name: true } } } },
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
  return Array.from(acc.values())
    .map((b) => ({
      ...b,
      accuracy: accuracyPercent(b.correct, b.answered),
    }))
    .sort((a, b) => {
      if (b.answered !== a.answered) return b.answered - a.answered;
      return a.topicName.localeCompare(b.topicName, "pt-BR");
    })
    .slice(0, MAX_TOPICS);
}

async function loadExams(userId: string) {
  const exams = await prisma.exam.findMany({
    where: {
      userId,
      status: "FINISHED",
      score: { not: null },
      finishedAt: { not: null },
    },
    select: { id: true, score: true, finishedAt: true },
    orderBy: { finishedAt: "asc" },
  });
  if (exams.length === 0) {
    return { totalFinished: 0, avgScore: 0, bestScore: 0, scores: [] };
  }
  const scores = exams.map((e) => ({
    examId: e.id,
    date: e.finishedAt!.toISOString(),
    score: Math.round((e.score ?? 0) * 100),
  }));
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return {
    totalFinished: scores.length,
    avgScore: Math.round(total / scores.length),
    bestScore: scores.reduce((best, s) => (s.score > best ? s.score : best), 0),
    scores,
  };
}

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const [overview, byTopic, exams] = await Promise.all([
    loadOverview(userId),
    loadByTopic(userId),
    loadExams(userId),
  ]);

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Estatísticas</h1>
      </header>

      {overview.totalAnswered === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          Responda algumas questões para começar a ver suas estatísticas.{" "}
          <Link href="/questions" className="text-accent hover:underline cursor-pointer">
            Ir para o banco de questões
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Respondidas" value={overview.totalAnswered} />
          <KpiCard label="Acerto geral" value={`${overview.accuracyAll}%`} />
          <KpiCard
            label="Streak"
            value={`${overview.currentStreak} dia${overview.currentStreak === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Esta semana"
            value={`${overview.totalAnsweredWeek} · ${overview.accuracyWeek}%`}
          />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Acurácia por matéria</h2>
        {byTopic.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma resposta com matéria atribuída ainda.
          </p>
        ) : (
          <div className="space-y-3">
            <TopicRadar data={byTopic} />
            <TopicAccuracyList items={byTopic} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Simulados</h2>
        {exams.totalFinished === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não finalizou nenhum simulado.{" "}
            <Link href="/exams" className="text-accent hover:underline cursor-pointer">
              Criar simulado
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Finalizados" value={exams.totalFinished} />
              <KpiCard label="Média" value={`${exams.avgScore}%`} />
              <KpiCard label="Melhor" value={`${exams.bestScore}%`} />
            </div>
            <ExamScoreLine data={exams.scores} />
          </div>
        )}
      </section>
    </section>
  );
}
