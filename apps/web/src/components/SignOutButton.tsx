"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="cursor-pointer rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-background"
    >
      Sair
    </button>
  );
}
