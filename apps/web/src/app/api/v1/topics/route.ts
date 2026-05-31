import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

export async function GET(): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const topics = await prisma.topic.findMany({
    select: { id: true, name: true },
  });

  topics.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return Response.json(topics);
}
