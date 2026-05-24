import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { NewExamForm } from "@/components/exams/NewExamForm";
import { ExamCard } from "@/components/exams/ExamCard";

export default async function ExamsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [subjects, exams] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.exam.findMany({
      where: { userId: session.user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        score: true,
        createdAt: true,
        finishedAt: true,
        questions: {
          select: { selectedAlternativeId: true },
        },
      },
    }),
  ]);

  const examsForList = exams.map((e) => ({
    id: e.id,
    status: e.status,
    score: e.score,
    createdAt: e.createdAt,
    finishedAt: e.finishedAt,
    questionCount: e.questions.length,
    answeredCount: e.questions.filter((q) => q.selectedAlternativeId !== null).length,
  }));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Simulados</h1>
        <p className="text-sm text-muted">
          Crie um novo simulado ou continue um em andamento.
        </p>
      </header>

      <NewExamForm subjects={subjects} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Meus simulados</h2>
        {examsForList.length === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não tem simulados. Crie o primeiro acima.
          </p>
        ) : (
          <div className="space-y-2">
            {examsForList.map((e) => (
              <ExamCard key={e.id} exam={e} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
