import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { Button } from "@/components/ui/Button";
import { FlashcardCard } from "@/components/flashcards/FlashcardCard";

export default async function FlashcardsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const [dueCount, cards] = await Promise.all([
    prisma.flashcard.count({
      where: { userId: session.user.id, nextReview: { lte: now } },
    }),
    prisma.flashcard.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        front: true,
        back: true,
        nextReview: true,
        topics: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
    }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Flashcards</h1>
        <p className="text-sm text-muted">
          {dueCount > 0
            ? `Você tem ${dueCount} card${dueCount === 1 ? "" : "s"} para revisar agora.`
            : "Nenhum card aguardando revisão."}
        </p>
      </header>

      <div className="flex gap-2">
        {dueCount > 0 && (
          <Link href="/flashcards/review">
            <Button type="button">Começar revisão</Button>
          </Link>
        )}
        <Link href="/flashcards/new">
          <Button type="button" variant="outline">
            + Criar novo
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Meus flashcards</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">
            Você ainda não criou nenhum flashcard.
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <FlashcardCard key={c.id} card={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
