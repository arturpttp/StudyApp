import type { NextAuthConfig } from "next-auth";

export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
} satisfies NextAuthConfig;
