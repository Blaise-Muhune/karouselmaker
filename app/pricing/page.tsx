import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { MarketingPricingSection } from "@/components/landing/MarketingPricingSection";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Karouselmaker plans: Starter, Pro, and Studio. AI carousels, exports, custom templates, and higher limits as you grow. Monthly pricing in USD.",
  openGraph: {
    title: "Pricing | Karouselmaker",
    description:
      "Starter, Pro, and Studio — same features, higher limits. AI carousels, exports, and templates for creators.",
  },
};

export default async function PricingPage() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

  return (
    <main className="min-h-screen flex flex-col">
      <LandingMarketingHeader highlightPlans />
      <section className="relative flex-1 flex flex-col items-center px-4 pt-10 pb-6 sm:pt-14 sm:pb-8">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent pointer-events-none -z-10 min-h-[40vh]" aria-hidden />
        <MarketingPricingSection className="mx-auto max-w-5xl w-full px-0 sm:px-4 mt-0" sectionId="pricing" />
        <p className="text-center text-muted-foreground text-xs max-w-md mt-10 mb-8">
          New accounts can try full paid-style limits on the first {FREE_FULL_ACCESS_GENERATIONS} carousels; after that,
          limits follow the free tier until you subscribe.
        </p>
        <div className="rounded-xl sm:rounded-2xl border border-border/50 bg-muted/5 p-6 sm:p-8 text-center max-w-xl w-full transition-colors hover:border-primary/30">
          <h3 className="font-semibold text-foreground text-base sm:text-lg mb-1">Ready to start?</h3>
          <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-5 max-w-md mx-auto">
            Create a free account, generate your first carousel, and upgrade when you need higher limits.
          </p>
          <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
            <Link href="/signup">
              <ArrowRight className="size-4 sm:size-5" />
              Get started free
            </Link>
          </Button>
        </div>
      </section>
      <LandingMarketingFooter />
    </main>
  );
}
