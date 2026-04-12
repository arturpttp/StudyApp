export function verificationEmailHtml(url: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #0f172a; font-size: 24px;">Confirme seu e-mail</h1>
  <p style="color: #334155; font-size: 16px; line-height: 1.5;">
    Obrigado por se cadastrar no HealthQuest! Clique no botão abaixo para confirmar seu endereço de e-mail.
  </p>
  <a href="${url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px; margin: 16px 0;">
    Confirmar e-mail
  </a>
  <p style="color: #64748b; font-size: 14px;">
    Se você não criou uma conta, ignore este e-mail. O link expira em 24 horas.
  </p>
</body>
</html>`;
}
