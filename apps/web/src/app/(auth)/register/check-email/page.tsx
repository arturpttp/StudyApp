"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setResent(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <img src="/logo.png" alt="HealthQuest" width={120} height={80} className="h-20 w-auto" />
        <h1 className="text-2xl font-semibold text-foreground">
          Verifique seu e-mail
        </h1>
      </div>
      <p className="text-sm text-muted">
        Enviamos um link de verificação para{" "}
        <span className="font-medium text-foreground">{email}</span>.
        Clique no link para ativar sua conta.
      </p>
      <div className="space-y-2">
        {resent ? (
          <p className="text-sm text-accent">Link reenviado com sucesso!</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="cursor-pointer text-sm text-accent underline hover:text-foreground disabled:opacity-50"
          >
            {resending ? "Reenviando..." : "Não recebeu? Reenviar link"}
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        <Link href="/login" className="text-foreground underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando...</p>}>
      <CheckEmailContent />
    </Suspense>
  );
}
