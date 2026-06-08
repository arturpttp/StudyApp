import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardEditor } from "@/components/flashcards/FlashcardEditor";

type PageProps = { searchParams: Promise<{ questionId?: string }> };

export default async function NewFlashcardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { questionId } = await searchParams;

  let initial: { front: string; back: string; topicIds: string[]; questionId?: string | null } = {
    front: "",
    back: "",
    topicIds: [],
  };

  if (questionId) {
    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        statement: true,
        explanation: true,
        alternatives: {
          select: { text: true, isCorrect: true },
          orderBy: { position: "asc" },
        },
        topics: { select: { id: true } },
      },
    });
    if (q) {
      const correct = q.alternatives.find((a) => a.isCorrect);
      initial = {
        front: q.statement,
        back:
          (correct ? correct.text : "") +
          (q.explanation ? "\n\n" + q.explanation : ""),
        topicIds: q.topics.map((t) => t.id),
        questionId: q.id,
      };
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Novo flashcard</h1>
        <p className="text-sm text-muted">
          Frente e verso são livres — formate como preferir.
        </p>
      </header>
      <FlashcardEditor mode="create" initial={initial} />
    </section>
  );
}
