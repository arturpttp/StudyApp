import { prisma } from "@healthquest/db";

export default async function HomePage() {
  const subjectCount = await prisma.subject.count();

  return (
    <main>
      <h1>HealthQuest</h1>
      <p>Plataforma de estudos para profissionais da saúde</p>
      <p>Especialidades cadastradas: {subjectCount}</p>
    </main>
  );
}
