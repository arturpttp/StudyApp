import { auth } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth>>>;

type AdminResult =
  | { session: Session; errorResponse: null }
  | { session: null; errorResponse: Response };

export async function requireAdmin(): Promise<AdminResult> {
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

  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      errorResponse: Response.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 },
      ),
    };
  }

  return { session, errorResponse: null };
}
