import { prisma } from "@healthquest/db";

export async function POST(req: Request): Promise<Response> {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!body.email || typeof body.email !== "string") {
    return Response.json({ status: "unknown" });
  }

  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  if (user && !user.emailVerified) {
    return Response.json({ status: "unverified" });
  }

  return Response.json({ status: "ok" });
}
