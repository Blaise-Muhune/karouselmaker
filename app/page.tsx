import { Link } from "next-view-transitions";
import { redirect } from "next/navigation";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  FolderKanban,
  Megaphone,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { HeroCarouselPreview } from "@/components/landing/HeroCarouselPreview";
import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { MarketingPricingSection } from "@/components/landing/MarketingPricingSection";
import { FREE_FULL_ACCESS_GENERATIONS, STARTER_PRICE_DISPLAY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-landing-sans",
  display: "swap",
});

const PAINS = [
  {
    title: "You post, then… silence",
    body: "Random tips and pretty slides get likes—but nobody connects them to your offer. Reach without a path to the product.",
  },
  {
    title: "Hard sells get scrolled past",
    body: "Opening with features and CTAs feels like an ad. Organic Instagram and TikTok reward problem-first stories people actually swipe.",
  },
  {
    title: "Inconsistent content kills momentum",
    body: "When every carousel is a one-off idea, angles repeat, niches blur, and you stop posting—the exact moment growth stalls.",
  },
] as const;

const OUTCOMES = [
  {
    icon: Target,
    title: "Organic product marketing",
    body: "Each carousel leads with the audience’s pain or desire, then soft-bridges to what you sell—built for first-time viewers, not existing fans.",
  },
  {
    icon: FolderKanban,
    title: "One project = one niche account",
    body: "Lock niche, product, and tone once. Topic ideas and new posts stay on-brand and avoid repeating what you already shipped.",
  },
  {
    icon: Megaphone,
    title: "Swipe-ready for Instagram & TikTok",
    body: "Hook → value slides → CTA, sized for feed and Stories. Export a ZIP and captions—post on the platforms where carousels win.",
  },
  {
    icon: TrendingUp,
    title: "Ship more, test more",
    body: "Generate, tweak the message and photo, export. Volume is how you find the hooks that actually convert in your niche.",
  },
] as const;

const STEPS = [
  {
    num: "01",
    title: "Define the offer",
    body: "Project = niche + product + tone. That’s the marketing brief for every carousel.",
  },
  {
    num: "02",
    title: "Generate organic content",
    body: "Pick a topic. AI drafts a problem-first swipe arc that soft-sells your product when it’s earned.",
  },
  {
    num: "03",
    title: "Post to IG & TikTok",
    body: "Quick edits, export PNG/JPEG + captions, publish. Then generate the next one.",
  },
] as const;

const FAQS = [
  {
    q: "Is this a design tool like Canva?",
    a: "No. Karouselmaker is a marketing tool: it turns your niche and product into organic Instagram and TikTok carousels. Templates keep slides looking good so you focus on the message—not dragging design boxes.",
  },
  {
    q: "What does “organic” mean here?",
    a: "Content that earns the swipe first—relatable problems, practical value, myths—then bridges to your product without opening like an ad. Built for discovery, not just followers who already know you.",
  },
  {
    q: "Instagram and TikTok?",
    a: "Yes. Carousels (and photo-mode swipe posts) are the format. Export the sizes and captions you need, then post on either platform.",
  },
  {
    q: "What's free?",
    a: `Create an account and try full-access limits on your first ${FREE_FULL_ACCESS_GENERATIONS} carousels. Paid plans start at ${STARTER_PRICE_DISPLAY}/mo when you need more volume.`,
  },
] as const;

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main
      className={cn(
        display.variable,
        sans.variable,
        "min-h-screen flex flex-col font-[family-name:var(--font-landing-sans)] antialiased"
      )}
    >
      <LandingMarketingHeader />

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.55_0.17_163_/_0.18),transparent_55%),linear-gradient(180deg,oklch(0.97_0.02_163)_0%,transparent_42%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.72_0.17_163_/_0.22),transparent_55%),linear-gradient(180deg,oklch(0.18_0.03_163)_0%,transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2] [background-image:linear-gradient(oklch(0.55_0.17_163_/_0.08)_1px,transparent_1px),linear-gradient(90deg,oklch(0.55_0.17_163_/_0.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-5xl px-4 pt-10 pb-8 sm:px-6 sm:pt-14 sm:pb-10 md:pt-16">
          <p className="font-[family-name:var(--font-landing-display)] text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl animate-in fade-in duration-500">
            Karouselmaker
          </p>
          <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-landing-display)] text-2xl font-medium leading-[1.15] tracking-tight text-foreground sm:text-3xl md:text-4xl animate-in fade-in slide-in-from-bottom-2 duration-700">
            Organic Instagram & TikTok carousels that market your product—without sounding like ads.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-in fade-in duration-700 delay-100">
            A marketing system for swipe content: niche + offer in, problem-first carousels out. Soft-sell your
            product while people discover you on IG and TikTok.
          </p>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center animate-in fade-in duration-700 delay-150">
            <Button
              size="lg"
              className="gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              asChild
            >
              <Link href="/signup">
                Start marketing with carousels
                <ArrowRight className="size-4 sm:size-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="transition-transform hover:scale-[1.02] active:scale-[0.98]"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground animate-in fade-in duration-700 delay-200">
            Free to start · No credit card · Full access on your first {FREE_FULL_ACCESS_GENERATIONS} carousels
          </p>
        </div>

        <div className="relative w-full border-y border-border/40 bg-muted/20 py-8 sm:py-10">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6">
            <p className="mb-5 text-center text-sm text-muted-foreground">
              Example organic arc — swipe like your audience will
            </p>
            <HeroCarouselPreview />
          </div>
        </div>
      </section>

      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">The marketing problem</p>
        <h2 className="mt-2 max-w-2xl font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Carousels grow accounts. Random content doesn’t grow the business.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          If you have a product or page to promote, Instagram and TikTok carousels are one of the highest-leverage
          formats—if every post teaches, relates, and eventually points to the offer. Most creators either go silent
          or post generic tips that never mention what they sell.
        </p>
        <ul className="mt-10 space-y-0 divide-y divide-border/60 border-y border-border/60">
          {PAINS.map((pain) => (
            <li key={pain.title} className="flex gap-4 py-5 sm:gap-5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <X className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">{pain.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">{pain.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative scroll-reveal [content-visibility:auto] border-y border-border/40 bg-muted/25 py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,oklch(0.55_0.17_163_/_0.1),transparent_50%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">How it works</p>
          <h2 className="mt-2 max-w-2xl font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            From offer to organic carousel in minutes
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <li key={step.num} className="min-w-0">
                <p className="font-[family-name:var(--font-landing-display)] text-3xl font-medium text-primary/80">
                  {step.num}
                </p>
                <h3 className="mt-2 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 overflow-hidden rounded-2xl border border-border/50 bg-background/60 p-4 sm:p-6">
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Same slide format you’ll export for Instagram & TikTok
            </p>
            <LandingDemoCarousel variant="strip" />
          </div>
        </div>
      </section>

      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What you get</p>
        <h2 className="mt-2 max-w-2xl font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Built to market through content—not to be a design studio
        </h2>
        <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {OUTCOMES.map((item) => (
            <li key={item.title} className="flex gap-4">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="scroll-reveal [content-visibility:auto] border-y border-border/40 bg-muted/20 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why Karouselmaker</p>
          <h2 className="mt-2 max-w-2xl font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Marketing workflow for organic swipe posts
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                What most people do
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Treat carousels as a design chore",
                  "Post tips with zero product context",
                  "Open with hard sells that get skipped",
                  "Go quiet when content takes too long",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="size-4" aria-hidden />
                With Karouselmaker
              </p>
              <ul className="space-y-2.5 text-sm text-foreground">
                {[
                  "Organic strategy baked into every generation",
                  "Niche + product remembered across posts",
                  "Problem-first slides, soft product bridge",
                  "Export and post to Instagram & TikTok today",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <MarketingPricingSection />

      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">FAQ</p>
        <h2 className="mt-2 text-center font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Straight answers
        </h2>
        <dl className="mt-10 space-y-6">
          {FAQS.map((item) => (
            <div key={item.q} className="border-b border-border/50 pb-6 last:border-0">
              <dt className="font-semibold text-foreground">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="scroll-reveal [content-visibility:auto] relative overflow-hidden border-t border-border/40">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,oklch(0.55_0.17_163_/_0.16),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Turn your niche into organic carousels that sell the result.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Set up a project, generate one Instagram/TikTok carousel, export, and post. Upgrade when you need more
            volume.
          </p>
          <Button size="lg" className="mt-7 gap-2" asChild>
            <Link href="/signup">
              Start free
              <ArrowRight className="size-4 sm:size-5" />
            </Link>
          </Button>
        </div>
      </section>

      <LandingMarketingFooter />
    </main>
  );
}
