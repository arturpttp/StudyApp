import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <span className="font-semibold text-foreground">HealthQuest</span>
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
