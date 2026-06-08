import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { auth } from "@/lib/auth/config";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { QueryProvider } from "@/components/QueryProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <NuqsAdapter>
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/"><Image src="/logo.png" alt="HealthQuest" width={120} height={40} className="h-10 w-auto" priority /></Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link href="/questions" className="text-muted hover:text-foreground transition-colors">
              Banco de Questões
            </Link>
            <Link href="/exams" className="text-muted hover:text-foreground transition-colors">
              Simulados
            </Link>
            <Link href="/flashcards" className="text-muted hover:text-foreground transition-colors">
              Flashcards
            </Link>
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin/questions/new"
                className="text-muted hover:text-foreground transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{session.user.name ?? session.user.email}</span>
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">
          <QueryProvider>{children}</QueryProvider>
        </main>
    </div>
    </NuqsAdapter>
  );
}
