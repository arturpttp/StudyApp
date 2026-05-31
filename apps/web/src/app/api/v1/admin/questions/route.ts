import { prisma } from "@healthquest/db";
import { requireAdmin } from "@/lib/api/require-admin";
import { createAdminQuestionBodySchema } from "@/lib/api/schemas/admin-questions";

export async function POST(req: Request): Promise<Response> {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const parsed = createAdminQuestionBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fields[key]) {
        fields[key] = issue.message;
      }
    }
    return Response.json({ error: "Dados inválidos.", fields }, { status: 400 });
  }

  const data = parsed.data;

  const institution = await prisma.institution.findUnique({
    where: { id: data.institutionId },
    select: { id: true },
  });
  if (!institution) {
    return Response.json(
      { error: "Instituição não encontrada." },
      { status: 404 },
    );
  }

  if (data.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
      select: { id: true },
    });
    if (!subject) {
      return Response.json(
        { error: "Especialidade não encontrada." },
        { status: 404 },
      );
    }
  }

  // Normalize new topic names: trim, lowercase-dedup
  const trimmedNew = data.newTopicNames.map((n) => n.trim()).filter(Boolean);
  const seen = new Map<string, string>();
  for (const name of trimmedNew) {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  const dedupedNewNames = Array.from(seen.values());

  const result = await prisma.$transaction(async (tx) => {
    const newTopicIds: string[] = [];
    for (const name of dedupedNewNames) {
      const topic = await tx.topic.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      newTopicIds.push(topic.id);
    }

    const allTopicIds = Array.from(new Set([...data.topicIds, ...newTopicIds]));

    const question = await tx.question.create({
      data: {
        statement: data.statement,
        explanation: data.explanation,
        difficulty: data.difficulty,
        year: data.year,
        subjectId: data.subjectId,
        institutionId: data.institutionId,
        topics: { connect: allTopicIds.map((id) => ({ id })) },
        alternatives: {
          create: data.alternatives.map((a) => ({
            text: a.text,
            isCorrect: a.isCorrect,
            position: a.position,
          })),
        },
      },
      select: { id: true },
    });

    return question;
  });

  return Response.json({ id: result.id }, { status: 201 });
}
