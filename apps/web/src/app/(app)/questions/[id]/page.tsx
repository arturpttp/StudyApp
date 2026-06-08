import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { QuestionSolver } from "@/components/questions/QuestionSolver";
import { getPreviousAnswer } from "@/lib/questions/get-previous-answer";
import { CreateFlashcardButton } from "@/components/flashcards/CreateFlashcardButton";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuestionDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      statement: true,
      difficulty: true,
      year: true,
      subject: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true } },
      alternatives: {
        select: { id: true, text: true, position: true },
        orderBy: { position: "asc" },
      },
      topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });

  if (!question) {
    notFound();
  }

  const previousAnswer = await getPreviousAnswer({
    userId: session.user.id,
    questionId: question.id,
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/questions"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        &larr; Banco de Questões
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        {question.subject && (
          <>
            <span className="text-xs text-muted">{question.subject.name}</span>
            <span className="text-xs text-muted">&middot;</span>
          </>
        )}
        <span className="text-xs text-muted">{question.institution.name}</span>
        {question.year && (
          <>
            <span className="text-xs text-muted">&middot;</span>
            <span className="text-xs text-muted">{question.year}</span>
          </>
        )}
      </div>

      {question.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {question.topics.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <CreateFlashcardButton questionId={question.id} />

      <QuestionSolver question={question} previousAnswer={previousAnswer} />
    </section>
  );
}
