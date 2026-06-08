import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@healthquest/db";
import { auth } from "@/lib/auth/config";
import { FlashcardReviewer } from "@/components/flashcards/FlashcardReviewer";

export default async function ReviewFlashcardsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id, nextReview: { lte: new Date() } },
    orderBy: { nextReview: "asc" },
    select: { id: true, front: true, back: true },
  });

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/flashcards"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        &larr; Flashcards
      </Link>
      <FlashcardReviewer cards={cards} />
    </section>
  );
}
