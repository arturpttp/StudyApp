import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

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
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <span className="font-semibold text-foreground">HealthQuest</span>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{session.user.name ?? session.user.email}</span>
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
