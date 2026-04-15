import { Link } from "next-view-transitions";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import {
  LayoutTemplate,
  FileText,
  Package,
  ArrowRight,
  ChevronsRight,
  Sparkles,
  Palette,
  Share2,
} from "lucide-react";
import { HeroCarouselPreview } from "@/components/landing/HeroCarouselPreview";
import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { MarketingPricingSection } from "@/components/landing/MarketingPricingSection";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main className="min-h-screen flex flex-col">
      <LandingMarketingHeader />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center px-4 py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-3xl text-center space-y-6 sm:space-y-8 relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Turn any idea into a{" "}
            <span className="text-primary">publish-ready carousel</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Paste a topic, link, or draft and generate a full Instagram/TikTok carousel in minutes. Edit everything in
            live preview, then export platform-ready images.
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
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-2 pt-1 text-left text-xs sm:grid-cols-3">
            {[
              "Template-locked layouts for consistent design",
              "Live slide preview with instant edits",
              "Export-ready sizes for feed and stories",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-muted-foreground">
                {item}
              </div>
            ))}
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
                Start from a topic or URL and get a complete first draft with hook, core points, and CTA.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <LayoutTemplate className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Projects, templates & brand</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Keep every carousel organized by project, reuse templates, and keep visuals aligned with your brand.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <FileText className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Text & layout editor</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Refine text, highlights, and zones in a live preview without leaving the editor flow.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Palette className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Backgrounds & images</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Use stock, web, uploads, or AI backgrounds and keep control of image placement and layout.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Package className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Export images & ZIP</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Export one slide or the full deck in the exact sizes you need for social publishing.
              </p>
            </li>
            <li className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 text-left transition-colors hover:border-primary/30">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Share2 className="size-4 sm:size-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Apply-to-all controls</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                Apply repeated style and visibility updates across slides in one action.
              </p>
            </li>
          </ul>
        </div>

        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-5xl w-full px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">
            Why creators choose us
          </p>
          <h2 className="text-center font-semibold text-foreground text-lg sm:text-xl mb-8">
            Built for fast publishing, not endless design work
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/10 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground">Karouselmaker</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Structured AI + template rules + export-ready output in one flow.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground">Manual design tools</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Maximum control, but slower production and repeated formatting work.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground">Generic AI tools</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Fast draft output, but often inconsistent slide structure and styling.
              </p>
            </div>
          </div>
        </div>

        <MarketingPricingSection />

        {/* Outcome hook */}
        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-12 sm:mt-14 max-w-2xl w-full px-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-6 text-center transition-colors hover:border-primary/30">
            <p className="text-foreground text-sm sm:text-base font-medium">
              Carousels consistently outperform single static posts for many creators. We handle structure and design so
              you can focus on ideas and publishing.
            </p>
          </div>
        </div>

        <div className="scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 max-w-3xl w-full px-4">
          <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">FAQ</p>
          <div className="space-y-3">
            {[
              {
                q: "Can I fully edit the AI output?",
                a: "Yes. You can edit text, backgrounds, styles, template slots, and per-slide visual settings before export.",
              },
              {
                q: "Do I need design skills?",
                a: "No. Templates lock the core layout so your slides stay clean and consistent while you focus on content.",
              },
              {
                q: "Can I use my own images?",
                a: "Yes. Upload from your library or import from Drive, then combine with stock, web, or AI images based on your workflow.",
              },
              {
                q: "What formats can I export?",
                a: "You can export single slides or full sets as PNG/JPEG in common social sizes, plus ZIP export flows.",
              },
              {
                q: "Is this built for solo creators?",
                a: "Yes. The product is optimized for fast creator workflows: idea to published carousel with minimal friction.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
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

      <LandingMarketingFooter />
    </main>
  );
}
