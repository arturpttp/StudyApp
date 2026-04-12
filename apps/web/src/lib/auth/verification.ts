import { randomBytes } from "node:crypto";
import { prisma } from "@healthquest/db";

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createVerificationToken(
  email: string,
): Promise<{ token: string; expires: Date }> {
  const token = generateVerificationToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  return { token, expires };
}

export async function consumeVerificationToken(
  email: string,
  token: string,
): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });

  if (!record) return false;
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });
    return false;
  }

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return true;
}
