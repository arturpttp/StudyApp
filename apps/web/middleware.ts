import NextAuth from "next-auth";
import authConfig from "@/lib/auth/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/questions/:path*",
    "/exams/:path*",
    "/flashcards/:path*",
    "/admin/:path*",
  ],
};
