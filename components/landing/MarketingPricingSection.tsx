import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { PAID_TIER_CARDS, PLAN_LIMITS, STARTER_PRICE_DISPLAY } from "@/lib/constants";

type MarketingPricingSectionProps = {
  /** For home page anchor `/#pricing` */
  sectionId?: string;
  className?: string;
};

export function MarketingPricingSection({ sectionId = "pricing", className }: MarketingPricingSectionProps) {
  return (
    <div
      id={sectionId}
      className={
        className ??
        "scroll-reveal [content-visibility:auto] mx-auto mt-20 w-full max-w-6xl px-4 sm:mt-28 sm:px-6 motion-reduce:animate-none"
      }
    >
      <div className="max-w-xl">
        <h2
          id="pricing-heading"
          className="font-[family-name:var(--font-landing-display)] text-3xl font-normal tracking-tight text-foreground sm:text-4xl"
        >
          Pricing that scales with posting volume
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Same organic Instagram & TikTok workflow on every plan. Higher limits from{" "}
          {STARTER_PRICE_DISPLAY}/mo.
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        {(() => {
          const L = PLAN_LIMITS.free;
          return (
            <div className="flex flex-col bg-background p-6 sm:p-7">
              <p className="text-sm font-medium text-foreground">Free</p>
              <p className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground">
                $0
                <span className="ml-1 text-sm font-sans text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Try the full marketing flow.</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
                <li>
                  {L.carouselsPerMonth} carousels · {L.exportsPerMonth} exports
                </li>
                <li>Stock & library images</li>
                <li>Export for IG & TikTok</li>
              </ul>
              <Button size="sm" className="mt-8 w-full" variant="outline" asChild>
                <Link href="/signup">Start free</Link>
              </Button>
            </div>
          );
        })()}
        {PAID_TIER_CARDS.map((tier) => {
          const L = PLAN_LIMITS[tier.id];
          const featured = tier.id === "pro";
          return (
            <div
              key={tier.id}
              className={`flex flex-col p-6 sm:p-7 ${
                featured ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm font-medium ${featured ? "text-primary-foreground" : "text-foreground"}`}>
                  {tier.name}
                </p>
                {featured ? (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/80">
                    Popular
                  </span>
                ) : null}
              </div>
              <p
                className={`mt-3 font-[family-name:var(--font-landing-display)] text-3xl tracking-tight ${
                  featured ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {tier.priceDisplay}
                <span
                  className={`ml-1 text-sm font-sans ${
                    featured ? "text-primary-foreground/75" : "text-muted-foreground"
                  }`}
                >
                  /mo
                </span>
              </p>
              <p className={`mt-2 text-sm ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {tier.blurb}
              </p>
              <ul
                className={`mt-6 flex-1 space-y-2.5 text-sm ${
                  featured ? "text-primary-foreground/85" : "text-muted-foreground"
                }`}
              >
                <li>
                  {L.carouselsPerMonth} carousels · {L.exportsPerMonth} exports
                </li>
                <li>Web image search · ZIP + captions</li>
                <li>Niche + offer projects</li>
              </ul>
              <Button
                size="sm"
                className="mt-8 w-full"
                variant={featured ? "secondary" : "outline"}
                asChild
              >
                <Link href="/signup">{featured ? "Choose Pro" : "Get started"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
