import { auth } from "@/lib/auth/config";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? session?.user?.email ?? "estudante";

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-900">
        Bem-vindo, {name}
      </h1>
      <p className="text-slate-600">
        Esta é a sua área protegida. Em breve: banco de questões, simulados e
        flashcards.
      </p>
    </section>
  );
}
