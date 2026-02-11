import { Link } from "next-view-transitions";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ContactUsModal } from "@/components/admin/ContactUsModal";
import {
  LayoutTemplate,
  FileText,
  Package,
  ArrowRight,
  ChevronsRight,
} from "lucide-react";
import { HeroCarouselPreview } from "@/components/landing/HeroCarouselPreview";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
          <Link href="/" className="font-semibold text-lg flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="" className="h-6 w-6" />
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
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-3xl text-center space-y-6 sm:space-y-8 relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Grow faster with{" "}
            <span className="text-primary">carousels</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Topic in, carousel out. No design skills needed—just your ideas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2">
            <Button size="lg" className="gap-2 w-full sm:w-auto transition-transform hover:scale-[1.02] active:scale-[0.98]" asChild>
              <Link href="/signup">
                <ArrowRight className="size-4 sm:size-5" />
                Get started free
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto transition-transform hover:scale-[1.02] active:scale-[0.98]" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* Animated carousel preview - mock Instagram output */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-12 sm:mt-16 w-full max-w-2xl px-4 flex flex-col items-center min-w-0">
          <p className="text-center text-muted-foreground text-sm mb-4 animate-in fade-in duration-500">Your next post, in seconds →</p>
          <HeroCarouselPreview />
        </div>

        {/* How it works */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-16 sm:mt-20 md:mt-24 max-w-5xl w-full relative px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">
            How it works
          </p>
          <h2 className="text-center font-semibold text-foreground text-lg sm:text-xl mb-8">
            4 steps to your first carousel
          </h2>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {[
              { num: 1, title: "Create project", desc: "Brand, niche, tone.", example: "Fitness tips" },
              { num: 2, title: "Enter topic", desc: "Paste topic or URL.", example: "5 habits of founders" },
              { num: 3, title: "Slides drafted", desc: "Hook, points, CTA.", example: null },
              { num: 4, title: "Edit & export", desc: "Tweak, export PNGs.", example: "1080×1080" },
            ].map((step, i) => (
              <div key={step.num} className="relative w-full min-w-0 max-w-[260px] sm:max-w-[280px]">
                <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 h-full flex flex-col transition-colors hover:border-border/80">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm">
                      {step.num}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm flex-1">{step.desc}</p>
                  {step.example && (
                    <div className="mt-3 rounded-lg bg-muted/20 p-2 sm:p-2.5 text-[10px] sm:text-xs font-mono text-muted-foreground truncate">
                      {step.example}
                    </div>
                  )}
                </div>
                {i < 3 && (
                  <div className="hidden xl:flex absolute top-1/2 -right-3 -translate-y-1/2 text-muted-foreground/40 pointer-events-none">
                    <ChevronsRight className="size-5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Slide preview */}
          <div className="mt-10 sm:mt-12 rounded-xl sm:rounded-2xl border border-border/50 bg-muted/10 p-4 sm:p-6 mx-auto max-w-2xl">
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
              {[
                { title: "5 habits of founders", type: "hook" },
                { title: "Wake up at 5am", type: "point" },
                { title: "Read 30 min daily", type: "point" },
                { title: "Follow @you", type: "cta" },
              ].map((slide) => (
                <div
                  key={slide.title}
                  className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px] aspect-square rounded-lg sm:rounded-xl border border-border/50 bg-muted/5 overflow-hidden snap-start"
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

        {/* Features */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-4xl w-full px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">
            Features
          </p>
          <ul className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3 justify-items-center">
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-center w-full max-w-[320px] transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3 mx-auto">
                <LayoutTemplate className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Projects & templates</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                One project per niche. Locked layouts—no design skills.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-center w-full max-w-[320px] transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3 mx-auto">
                <FileText className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Content drafted</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Topic or URL in, full deck out. Edit, reorder, regenerate.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-center w-full max-w-[320px] transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2 sm:mb-3 mx-auto">
                <Package className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Export ready</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                Your images or suggested. Export ZIP with caption.
              </p>
            </li>
          </ul>
        </div>

        {/* Outcome hook */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-12 sm:mt-14 max-w-2xl w-full px-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-6 text-center transition-colors hover:border-primary/30">
            <p className="text-foreground text-sm sm:text-base font-medium">
              Carousels drive 3–5× more engagement than single-image posts. We&apos;ll handle the design—you just bring the ideas.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-xl w-full px-4">
          <div className="rounded-xl sm:rounded-2xl border border-border/50 bg-muted/5 p-6 sm:p-8 text-center transition-colors hover:border-primary/30">
            <h3 className="font-semibold text-foreground text-base sm:text-lg mb-1">
              Ready to ship your first carousel?
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-5">
              No design skills. Templates handle layout. You focus on ideas.
            </p>
            <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
              <Link href="/signup">
                <ArrowRight className="size-4 sm:size-5" />
                Get started free
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 mt-12 sm:mt-16">
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
