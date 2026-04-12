"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerSchema } from "@/lib/auth/schemas";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          (key === "name" ||
            key === "email" ||
            key === "password" ||
            key === "confirmPassword") &&
          !next[key]
        ) {
          next[key] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      setSubmitting(false);
      if (res.status === 409) {
        setError("E-mail já cadastrado.");
        return;
      }
      if (res.status === 400) {
        const json = await res.json().catch(() => null);
        if (json?.fields) setFieldErrors(json.fields);
        else setError("Dados inválidos.");
        return;
      }
      setError("Erro ao criar conta. Tente novamente.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    setSubmitting(false);

    if (!signInResult || signInResult.error) {
      setError("Conta criada, mas não foi possível entrar. Tente fazer login.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Criar conta</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
          {fieldErrors.name && (
            <span className="mt-1 block text-xs text-danger">
              {fieldErrors.name}
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          {fieldErrors.email && (
            <span className="mt-1 block text-xs text-danger">
              {fieldErrors.email}
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />
          {fieldErrors.password && (
            <span className="mt-1 block text-xs text-danger">
              {fieldErrors.password}
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Confirmar senha</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={inputClass}
          />
          {fieldErrors.confirmPassword && (
            <span className="mt-1 block text-xs text-danger">
              {fieldErrors.confirmPassword}
            </span>
          )}
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
      <p className="text-sm text-muted">
        Já tem uma conta?{" "}
        <Link href="/login" className="text-foreground underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
