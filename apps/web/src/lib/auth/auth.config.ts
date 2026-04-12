import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";

export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [GitHub, Discord, Google],
} satisfies NextAuthConfig;
