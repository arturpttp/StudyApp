import { auth } from "@/lib/auth";

type AuthResult =
  | { session: Awaited<ReturnType<typeof auth>> & {}; errorResponse: null }
  | { session: null; errorResponse: Response };

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      errorResponse: Response.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  return { session, errorResponse: null };
}
