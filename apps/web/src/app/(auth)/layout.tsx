import Image from "next/image";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <Link href="/"><Image src="/logo.png" alt="HealthQuest" width={120} height={40} className="h-10 w-auto" priority /></Link>
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
