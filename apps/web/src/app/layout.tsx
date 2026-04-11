import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HealthQuest",
  description: "Plataforma de estudos para profissionais da saúde",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
