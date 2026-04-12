import { Resend } from "resend";
import { verificationEmailHtml } from "./templates";

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "HealthQuest <noreply@healthquest.com.br>",
    to,
    subject: "Confirme seu e-mail — HealthQuest",
    html: verificationEmailHtml(url),
  });
}
