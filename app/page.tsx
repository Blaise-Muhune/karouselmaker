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
  Gem,
  Check,
  Sparkles,
  Palette,
  Share2,
} from "lucide-react";
import { HeroCarouselPreview } from "@/components/landing/HeroCarouselPreview";
import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { PRO_PRICE_DISPLAY, PLAN_LIMITS } from "@/lib/constants";

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
            <Button variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5" asChild>
              <Link href="/signup">
                <Gem className="size-4" />
                Go Pro
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

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center px-4 py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-3xl text-center space-y-6 sm:space-y-8 relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Grow faster with{" "}
            <span className="text-primary">carousels</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Turn a topic or link into a full slide deck. Edit text, backgrounds, and layout on a live preview—then export
            high-res images and a ZIP with a caption. No design skills needed.
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
              { num: 1, title: "Create project", desc: "Organize carousels by brand, niche, and tone.", example: "Fitness tips" },
              { num: 2, title: "Enter topic or link", desc: "One prompt or URL—AI drafts hooks, points, and CTAs.", example: "5 habits of founders" },
              { num: 3, title: "Slides generated", desc: "Structured slides match your template—ready to refine.", example: null },
              {
                num: 4,
                title: "Edit & ship",
                desc: "Adjust text, highlights, backgrounds, slide chrome, and sizes—then export PNG/JPEG.",
                example: "Square · 4:5 · Stories",
              },
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

          {/* Slide preview — real in-app template (SlidePreview), not a mock */}
          <div className="mt-10 sm:mt-12 rounded-xl sm:rounded-2xl border border-border/50 bg-muted/10 p-4 sm:p-6 mx-auto max-w-2xl">
            <p className="text-center text-muted-foreground text-xs mb-3">
              Same renderer as the editor — headline + body zones, slide numbers, swipe hint
            </p>
            <LandingDemoCarousel variant="strip" />
          </div>
        </div>

        {/* Features */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-5xl w-full px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">
            Features
          </p>
          <h2 className="text-center font-semibold text-foreground text-lg sm:text-xl mb-2 max-w-2xl mx-auto">
            Everything you need to publish scroll-stopping carousels
          </h2>
          <p className="text-center text-muted-foreground text-sm max-w-xl mx-auto mb-8">
            Built for creators: structured AI output, template-locked design, and a fast editor—without turning you into a designer.
          </p>
          <ul className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-stretch">
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Sparkles className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">AI from topic or link</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Describe an idea or paste a URL. Get a full carousel with hooks, bullet slides, and a CTA—structured for your template, not random layouts.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <LayoutTemplate className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Projects, templates & brand</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Organize work by project. Pick proven layouts (and custom templates on Pro). Brand kit flows into slides—logo, colors, and attribution where you want them.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <FileText className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Text & layout editor</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Headline and body with fonts, highlights, and outlines. Drag text zones on the preview. Tune slide chrome—slide numbers, swipe hint, logo, and watermark—with controls that jump to the right panel when you tap the canvas.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Palette className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Backgrounds & images</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Solid colors, uploads, and your asset library. Pro unlocks AI-generated backgrounds and deeper image controls (including multi-image layouts where templates allow).
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Package className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Export images & ZIP</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                PNG or JPEG at 1080×1080 (feed), 1080×1350 (portrait), or 1080×1920 (Stories/Reels). Download one frame or a full ZIP with a copy-ready caption.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Share2 className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Apply-to-all controls</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Keep decks consistent fast: apply headline, body, background, and visibility settings across all slides in one tap.
              </p>
            </li>
          </ul>
        </div>

        {/* Premium / Pricing */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-lg w-full px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">
            Premium
          </p>
          <div className="rounded-xl sm:rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-8 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Gem className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Pro</h3>
                <p className="text-2xl font-bold text-foreground">
                  {PRO_PRICE_DISPLAY}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-6">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {PLAN_LIMITS.pro.carouselsPerMonth} carousels per month
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {PLAN_LIMITS.pro.exportsPerMonth} exports per month
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {PLAN_LIMITS.pro.assets} images in asset library
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {PLAN_LIMITS.pro.customTemplates} custom templates
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                AI backgrounds, asset library, full editor
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                Apply-to-all editing for fast consistency
              </li>
            </ul>
            <Button size="lg" className="w-full gap-2" asChild>
              <Link href="/signup">
                <Gem className="size-4" />
                Get started with Pro
              </Link>
            </Button>
          </div>
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
            <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-5 max-w-md mx-auto">
              Templates keep every slide on-brand. You edit copy, visuals, and chrome—then export in the format your platform needs.
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
            <Link href="/copyright" className="hover:text-foreground transition-colors">Copyright</Link>
            <ContactUsModal userEmail="" />
          </div>
        </div>
      </footer>
    </main>
  );
}
