import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingMarketingHeader({ highlightPlans }: { highlightPlans?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          <img src="/logo.svg" alt="" className="h-5 w-5" />
          <span className="font-[family-name:var(--font-landing-display)] text-lg tracking-tight">
            Karouselmaker
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button
            variant={highlightPlans ? "secondary" : "ghost"}
            size="sm"
            className="hidden sm:inline-flex text-muted-foreground"
            asChild
          >
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
