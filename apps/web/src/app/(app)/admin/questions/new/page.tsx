import { prisma } from "@healthquest/db";
import { NewQuestionForm } from "@/components/admin/NewQuestionForm";

export default async function NewAdminQuestionPage() {
  const [subjects, institutions] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Cadastrar pergunta
        </h1>
        <p className="text-sm text-muted">Acesso restrito a administradores.</p>
      </header>
      <NewQuestionForm subjects={subjects} institutions={institutions} />
    </section>
  );
}
