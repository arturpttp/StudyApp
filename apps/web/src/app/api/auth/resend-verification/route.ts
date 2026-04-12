import { prisma } from "@healthquest/db";
import { createVerificationToken } from "@/lib/auth/verification";
import { sendVerificationEmail } from "@/lib/email/resend";

export async function POST(req: Request): Promise<Response> {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!body.email || typeof body.email !== "string") {
    return Response.json({ error: "E-mail obrigatório." }, { status: 400 });
  }

  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    const { token } = await createVerificationToken(email);
    await sendVerificationEmail(email, token);
  }

  return Response.json({ message: "Se o e-mail estiver cadastrado, enviaremos um novo link." });
}
