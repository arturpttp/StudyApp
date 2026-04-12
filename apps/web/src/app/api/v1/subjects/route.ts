import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

export async function GET(): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Response.json(subjects);
}
