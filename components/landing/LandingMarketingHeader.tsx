import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Gem } from "lucide-react";

export function LandingMarketingHeader({ highlightPlans }: { highlightPlans?: boolean }) {
  return (
    <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        <Link href="/" className="font-semibold text-lg flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="" className="h-6 w-6" />
          Karouselmaker
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button
            variant={highlightPlans ? "secondary" : "outline"}
            size="sm"
            className="hidden sm:inline-flex gap-1.5"
            asChild
          >
            <Link href="/pricing">
              <Gem className="size-4" />
              Plans
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
