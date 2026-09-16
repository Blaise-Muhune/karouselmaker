import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";
import { Instrument_Serif, Manrope } from "next/font/google";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { MarketingPricingSection } from "@/components/landing/MarketingPricingSection";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
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

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Karouselmaker pricing for AI-generated Instagram and TikTok carousels. Start with three complete post packs, then choose the plan that fits your publishing rhythm.",
  openGraph: {
    title: "Pricing | Karouselmaker",
    description:
      "Start with three complete carousel post packs, then choose a plan for your publishing rhythm.",
  },
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main
      className={cn(
        display.variable,
        sans.variable,
        "min-h-screen flex flex-col bg-background font-[family-name:var(--font-landing-sans)] antialiased"
      )}
    >
      <LandingMarketingHeader highlightPlans />
      <section className="relative flex-1 px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <MarketingPricingSection className="mx-auto mt-0 w-full max-w-6xl px-0" sectionId="pricing" />
        <p className="mx-auto mt-10 max-w-lg text-center text-sm text-muted-foreground">
          New accounts get {FREE_FULL_ACCESS_GENERATIONS} complete post packs, once. You can keep editing and downloading every post you create.
        </p>
        <div className="mx-auto mt-14 flex max-w-6xl flex-col items-start justify-between gap-6 border-t border-border/50 pt-12 sm:flex-row sm:items-end">
          <div className="max-w-md">
            <h3 className="font-[family-name:var(--font-landing-display)] text-2xl tracking-tight text-foreground sm:text-3xl">
              Ready to market with carousels?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a free account, ship your first organic Instagram or TikTok carousel, and upgrade when you need more
              volume.
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
