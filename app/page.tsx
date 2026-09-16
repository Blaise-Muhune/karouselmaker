import { Link } from "next-view-transitions";
import { redirect } from "next/navigation";
import { Instrument_Serif, Manrope } from "next/font/google";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HeroCarouselPreview } from "@/components/landing/HeroCarouselPreview";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { MarketingPricingSection } from "@/components/landing/MarketingPricingSection";
import { FREE_FULL_ACCESS_GENERATIONS, CREATOR_PRICE_DISPLAY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-landing-sans",
  display: "swap",
});

const STEPS = [
  {
    title: "Set up the project",
    body: "One workspace keeps your niche, offer, brand context, and every generated carousel together.",
  },
  {
    title: "Generate the post",
    body: "Create the title, problem-first slide arc, caption, and hashtags from one focused topic.",
  },
  {
    title: "Refine and publish",
    body: "Pick a template collection, adjust a slide if needed, and download a ready-to-upload ZIP with copy ready to paste.",
  },
] as const;

const FAQS = [
  {
    q: "Is this a design tool?",
    a: "It is a focused carousel publishing workspace. AI creates the content; template collections keep the design polished while you make only the edits that matter.",
  },
  {
    q: "What does organic mean here?",
    a: "Content that earns attention first—problems, myths, practical value—then bridges to your product without opening like an ad.",
  },
  {
    q: "Instagram and TikTok?",
    a: "Yes. Generate one post, choose its placement, then download slides in posting order with the title, caption, and hashtags ready to copy.",
  },
  {
    q: "What’s free?",
    a: `Create ${FREE_FULL_ACCESS_GENERATIONS} complete posts free. Paid plans start at ${CREATOR_PRICE_DISPLAY}/mo when you want a consistent posting rhythm.`,
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
        "min-h-screen flex flex-col bg-background font-[family-name:var(--font-landing-sans)] text-foreground antialiased"
      )}
    >
      <LandingMarketingHeader />

      {/* Hero: one composition — brand, line, CTA, full-bleed product */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(72vh,640px)] bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,oklch(0.55_0.14_163_/_0.12),transparent_60%)] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,oklch(0.55_0.14_163_/_0.2),transparent_55%)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20 md:pt-24">
          <h1 className="font-[family-name:var(--font-landing-display)] text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-tight text-foreground animate-in fade-in duration-500 motion-reduce:animate-none">
            Karouselmaker
          </h1>
          <p className="mt-6 max-w-[22ch] font-[family-name:var(--font-landing-display)] text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.2] tracking-tight text-foreground/90 animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none sm:max-w-xl">
            Create polished Instagram & TikTok carousels from one project brief.
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base animate-in fade-in duration-700 delay-100 motion-reduce:animate-none">
            Generate the title, slides, caption, and hashtags. Refine with templates, then publish with confidence.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center animate-in fade-in duration-700 delay-150 motion-reduce:animate-none">
            <Button size="lg" className="h-11 gap-2 px-6 text-[15px]" asChild>
              <Link href="/signup">
                Start free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" className="h-11 px-4 text-[15px] text-muted-foreground" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground animate-in fade-in duration-700 delay-200 motion-reduce:animate-none">
            No card required · Full access on your first {FREE_FULL_ACCESS_GENERATIONS} carousels
          </p>
        </div>

        <div className="relative mt-12 sm:mt-16">
          <div className="border-y border-[oklch(0.28_0.04_163)] bg-[oklch(0.16_0.03_163)] py-8 sm:py-10 dark:border-border/30">
            <p className="mb-6 px-4 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-white/45 sm:px-6">
              Example organic arc
            </p>
            <HeroCarouselPreview />
          </div>
        </div>
      </section>

      {/* Problem — editorial, no icon list */}
      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 motion-reduce:animate-none">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:items-end">
          <div>
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]">
              Create a complete carousel post without rebuilding the strategy every time.
            </h2>
          </div>
          <p className="text-[15px] leading-[1.7] text-muted-foreground sm:text-base">
            A project keeps the context that makes your posts consistent. Start with a useful idea, generate a clear
            swipe arc, select the right templates, and leave with the visuals and copy needed to publish.
          </p>
        </div>
      </section>

      {/* How it works — three beats, no numbered SaaS cards */}
      <section className="scroll-reveal [content-visibility:auto] border-y border-border/50 bg-muted/30 py-20 sm:py-28 motion-reduce:animate-none">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-lg font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground sm:text-4xl">
            From brief to feed in minutes
          </h2>
          <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-12">
            {STEPS.map((step, i) => (
              <li key={step.title} className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                  Step {i + 1}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-landing-display)] text-xl tracking-tight text-foreground sm:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Positioning — one clear claim */}
      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 motion-reduce:animate-none">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground sm:text-4xl">
            A complete carousel workflow, from idea to upload
          </h2>
          <ul className="mt-10 space-y-6 border-t border-border/60 pt-8">
            {[
              {
                title: "Content with a clear point",
                body: "Start with the audience’s pain, question, or opportunity. The generator turns it into a strong hook, useful slides, and a fitting close.",
              },
              {
                title: "One project = one content hub",
                body: "Niche, product, tone, templates, and every generated carousel stay together so the next post starts with context.",
              },
              {
                title: "Ready for IG & TikTok",
                body: "Generate a clear title, hook → value → CTA slides, a caption, and hashtags. Export a ZIP sized for the feed you are posting to.",
              },
            ].map((item) => (
              <li key={item.title} className="grid gap-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-8">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MarketingPricingSection />

      <section className="scroll-reveal [content-visibility:auto] mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 motion-reduce:animate-none">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground sm:text-4xl">
            Questions
          </h2>
          <dl className="space-y-0 divide-y divide-border/60 border-y border-border/60">
            {FAQS.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="text-[15px] font-medium text-foreground sm:text-base">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="scroll-reveal [content-visibility:auto] border-t border-border/50 motion-reduce:animate-none">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-24">
          <div className="max-w-lg">
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground sm:text-4xl">
              Create the next carousel today
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Set up the project. Generate. Refine. Download slides and copy for Instagram or TikTok.
            </p>
          </div>
          <Button size="lg" className="h-11 shrink-0 gap-2 px-6" asChild>
            <Link href="/signup">
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <LandingMarketingFooter />
    </main>
  );
}
