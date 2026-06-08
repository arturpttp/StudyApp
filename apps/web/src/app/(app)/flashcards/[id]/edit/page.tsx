import { notFound, redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardEditor } from "@/components/flashcards/FlashcardEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditFlashcardPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const card = await prisma.flashcard.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      front: true,
      back: true,
      questionId: true,
      topics: { select: { id: true } },
    },
  });
  if (!card) notFound();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Editar flashcard</h1>
        <p className="text-sm text-muted">
          Editar conteúdo não reseta o progresso de revisão.
        </p>
      </header>
      <FlashcardEditor
        mode="edit"
        initial={{
          id: card.id,
          front: card.front,
          back: card.back,
          topicIds: card.topics.map((t) => t.id),
          questionId: card.questionId,
        }}
      />
    </section>
  );
}
