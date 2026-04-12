import { Resend } from "resend";
import { verificationEmailHtml } from "./templates";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "HealthQuest <noreply@healthquest.com.br>",
    to,
    subject: "Confirme seu e-mail — HealthQuest",
    html: verificationEmailHtml(url),
  });
}
