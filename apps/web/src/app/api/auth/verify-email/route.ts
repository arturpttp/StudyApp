import { prisma } from "@healthquest/db";
import { consumeVerificationToken } from "@/lib/auth/verification";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return Response.redirect(new URL("/login?error=link-invalido", req.url));
  }

  const valid = await consumeVerificationToken(email.toLowerCase(), token);
  if (!valid) {
    return Response.redirect(new URL("/login?error=link-invalido", req.url));
  }

  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: new Date() },
  });

  return Response.redirect(new URL("/login?verified=1", req.url));
}
