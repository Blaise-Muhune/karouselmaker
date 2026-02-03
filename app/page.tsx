import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImageIcon, LayoutTemplateIcon, SparklesIcon } from "lucide-react";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
          <span className="font-semibold text-lg">Karouselmaker</span>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Swipe carousels from topics or URLs
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Create viral-style slide decks in seconds. Pick a niche, add a topic or link, and let AI write the copy. Locked templates and your brand—ready to export.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                <SparklesIcon className="mr-2 size-5" />
                Start creating
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <ul className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-2 md:gap-8">
          <li className="rounded-xl border border-border/60 bg-card p-6 shadow-sm text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <LayoutTemplateIcon className="size-5" />
            </div>
            <h2 className="font-semibold text-foreground">Templates & brand</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Locked layouts and your colors. AI writes the text; templates control the look.
            </p>
          </li>
          <li className="rounded-xl border border-border/60 bg-card p-6 shadow-sm text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <ImageIcon className="size-5" />
            </div>
            <h2 className="font-semibold text-foreground">Backgrounds & export</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Your images or AI-suggested Unsplash. Gradient overlays, then export as PNGs.
            </p>
          </li>
        </ul>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-5xl px-4 md:px-6 text-center text-muted-foreground text-sm">
          Karouselmaker — creator-first carousel tool
        </div>
      </footer>
    </main>
  );
}
