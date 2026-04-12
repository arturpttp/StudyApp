import { auth } from "@/lib/auth/config";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "estudante";

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">
        Bem-vindo, {name}
      </h1>
      <p className="text-muted">
        Esta é a sua área protegida. Em breve: banco de questões, simulados e
        flashcards.
      </p>
    </section>
  );
}
