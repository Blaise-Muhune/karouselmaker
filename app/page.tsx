import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ContactUsModal } from "@/components/admin/ContactUsModal";
import {
  ImageIcon,
  SparklesIcon,
  FolderOpenIcon,
  DownloadIcon,
  ArrowRightIcon,
} from "lucide-react";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity">
            Karouselmaker
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center px-4 py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/3 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-3xl text-center space-y-6 sm:space-y-8 relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Carousel posts in{" "}
            <span className="text-primary">minutes</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Topic or URL in → AI drafts slides → Edit & export. Ready for Instagram & LinkedIn.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2">
            <Button size="lg" className="gap-2 w-full sm:w-auto" asChild>
              <Link href="/signup">
                <SparklesIcon className="size-4 sm:size-5" />
                Get started free
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* How it works - compact */}
        <div className="mx-auto mt-16 sm:mt-20 md:mt-24 max-w-5xl w-full relative">
          <h2 className="text-center font-semibold text-foreground text-lg sm:text-xl mb-2">
            How it works
          </h2>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4 mt-8">
            {[
              { num: 1, title: "Create project", desc: "Brand, niche, tone.", example: "Fitness tips" },
              { num: 2, title: "Enter topic", desc: "Paste topic or URL.", example: "5 habits of founders" },
              { num: 3, title: "AI generates", desc: "Hook, points, CTA.", example: null },
              { num: 4, title: "Edit & export", desc: "Tweak, export PNGs.", example: "1080×1080" },
            ].map((step, i) => (
              <div key={step.num} className="relative">
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 h-full flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm">
                      {step.num}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm flex-1">{step.desc}</p>
                  {step.example && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-2 sm:p-2.5 text-[10px] sm:text-xs font-mono text-muted-foreground truncate">
                      {step.example}
                    </div>
                  )}
                </div>
                {i < 3 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 text-muted-foreground/40">
                    <ArrowRightIcon className="size-5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Slide preview */}
          <div className="mt-10 sm:mt-12 rounded-xl sm:rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
              {[
                { title: "5 habits of founders", type: "hook" },
                { title: "Wake up at 5am", type: "point" },
                { title: "Read 30 min daily", type: "point" },
                { title: "Follow @you", type: "cta" },
              ].map((slide) => (
                <div
                  key={slide.type}
                  className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px] aspect-square rounded-lg sm:rounded-xl border border-border bg-card overflow-hidden shadow-sm snap-start"
                >
                  <div className="h-full flex flex-col p-3 sm:p-4 justify-between bg-linear-to-b from-muted/40 to-muted">
                    <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {slide.type}
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-3">
                      {slide.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features - compact */}
        <div className="mx-auto mt-14 sm:mt-16 md:mt-20 max-w-4xl w-full px-0">
          <ul className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3">
            <li className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 text-left">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3">
                <FolderOpenIcon className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Projects & templates</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                One project per niche. Locked layouts—no design skills.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 text-left">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3">
                <SparklesIcon className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">AI content</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Topic or URL in, full deck out. Edit, reorder, regenerate.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 text-left">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3">
                <ImageIcon className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Export ready</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Your images or AI-suggested. Export ZIP with caption.
              </p>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-14 sm:mt-16 md:mt-20 max-w-xl w-full px-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-6 sm:p-8 text-center">
            <h3 className="font-semibold text-foreground text-base sm:text-lg mb-1">
              Ready?
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-5">
              No design skills. Templates handle layout.
            </p>
            <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
              <Link href="/signup">
                <SparklesIcon className="size-4 sm:size-5" />
                Get started free
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 mt-12 sm:mt-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <span>Karouselmaker</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <ContactUsModal userEmail="" />
          </div>
        </div>
      </footer>
    </main>
  );
}
