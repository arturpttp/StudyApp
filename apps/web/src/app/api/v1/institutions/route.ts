import { prisma } from "@healthquest/db";
import { requireAuth } from "@/lib/api/require-auth";

export async function GET(): Promise<Response> {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Response.json(institutions);
}
