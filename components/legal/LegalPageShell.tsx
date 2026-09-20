import Link from "next/link";
import type { ReactNode } from "react";
import { ContactUsModal } from "@/components/admin/ContactUsModal";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type LegalPageShellProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

/** Shared public shell so every policy page exposes the same current navigation and support path. */
export function LegalPageShell({ title, updated, children }: LegalPageShellProps) {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold transition-opacity hover:opacity-80">
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-md object-contain" />
            Karouselmaker
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account navigation">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild><Link href="/login">Sign in</Link></Button>
            <Button size="sm" asChild><Link href="/signup">Start creating</Link></Button>
          </nav>
        </div>
      </header>
      <article className="mx-auto flex-1 w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm sm:p-8 md:p-10">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Last updated: {updated}</p>
          <div className="mt-8 space-y-8 text-sm text-foreground sm:mt-10 sm:space-y-10 sm:text-base">{children}</div>
        </div>
      </article>
      <footer className="mt-8 border-t py-6 sm:mt-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:gap-4 sm:px-6 sm:text-sm">
          <span>Made with KarouselMaker.com</span>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/copyright" className="transition-colors hover:text-foreground">Copyright</Link>
            <ContactUsModal userEmail="" />
          </div>
        </div>
      </footer>
    </main>
  );
}
