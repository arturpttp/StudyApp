"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
    >
      Sair
    </button>
  );
}
