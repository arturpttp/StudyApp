import { prisma } from "@healthquest/db";
import { loginSchema } from "./schemas";
import { verifyPassword } from "./password";

export async function authorizeCredentials(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  if (!user.password) return null;

  if (!user.emailVerified) return null;

  const ok = await verifyPassword(parsed.data.password, user.password);
  if (!ok) return null;

  return { id: user.id, name: user.name, email: user.email };
}
