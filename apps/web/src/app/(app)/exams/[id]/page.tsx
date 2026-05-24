import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { ExamRunner } from "@/components/exams/ExamRunner";
import { ExamReport } from "@/components/exams/ExamReport";

type PageProps = { params: Promise<{ id: string }> };

export default async function ExamDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      score: true,
      timeLimit: true,
      createdAt: true,
      finishedAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          selectedAlternativeId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              alternatives: {
                orderBy: { position: "asc" },
                select: { id: true, text: true, position: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const header = (
    <Link
      href="/exams"
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
    >
      &larr; Simulados
    </Link>
  );

  if (exam.status === "IN_PROGRESS") {
    const runnerExam = {
      id: exam.id,
      timeLimit: exam.timeLimit,
      createdAt: exam.createdAt.toISOString(),
      questions: exam.questions.map((eq) => ({
        questionId: eq.question.id,
        order: eq.order,
        statement: eq.question.statement,
        alternatives: eq.question.alternatives.map((a) => ({
          id: a.id,
          text: a.text,
          position: a.position,
        })),
        selectedAlternativeId: eq.selectedAlternativeId,
      })),
    };

    return (
      <section className="mx-auto max-w-3xl space-y-6">
        {header}
        <ExamRunner exam={runnerExam} />
      </section>
    );
  }

  const reportExam = {
    id: exam.id,
    score: exam.score ?? 0,
    createdAt: exam.createdAt.toISOString(),
    finishedAt: (exam.finishedAt ?? exam.createdAt).toISOString(),
    questions: exam.questions.map((eq) => {
      const correct = eq.question.alternatives.find((a) => a.isCorrect)!;
      return {
        questionId: eq.question.id,
        order: eq.order,
        statement: eq.question.statement,
        explanation: eq.question.explanation,
        alternatives: eq.question.alternatives.map((a) => ({
          id: a.id,
          text: a.text,
          position: a.position,
        })),
        selectedAlternativeId: eq.selectedAlternativeId,
        correctAlternativeId: correct.id,
        isCorrect:
          eq.selectedAlternativeId !== null &&
          eq.selectedAlternativeId === correct.id,
      };
    }),
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {header}
      <ExamReport exam={reportExam} />
    </section>
  );
}
