import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { Check, Gem } from "lucide-react";
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
      className={className ?? "scroll-reveal [content-visibility:auto] mx-auto mt-14 sm:mt-16 md:mt-20 max-w-5xl w-full px-4"}
    >
      <p className="text-muted-foreground text-center mb-3 text-xs font-medium uppercase tracking-wider">Plans</p>
      <h2
        id="pricing-heading"
        className="text-center font-semibold text-foreground text-lg sm:text-xl mb-2"
      >
        Free, Starter, Pro, Studio
      </h2>
      <p className="text-center text-muted-foreground text-sm max-w-xl mx-auto mb-8">
        Start free, then upgrade as you scale. From {STARTER_PRICE_DISPLAY}/mo for paid plans.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(() => {
          const L = PLAN_LIMITS.free;
          return (
            <div className="rounded-xl border border-border/60 bg-background p-5 sm:p-6 flex flex-col transition-colors">
              <h3 className="font-semibold text-foreground">Free</h3>
              <p className="text-xl font-bold text-foreground">
                $0
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground mb-4">Try the product before upgrading.</p>
              <ul className="space-y-2 text-xs text-muted-foreground flex-1 mb-5">
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  {L.carouselsPerMonth} carousels · {L.exportsPerMonth} exports · {L.assets} library images
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  {L.customTemplates} custom template · AI image generation off
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  Full editor with basic limits
                </li>
              </ul>
              <Button size="sm" className="w-full gap-1.5 mt-auto" variant="outline" asChild>
                <Link href="/signup">Start free</Link>
              </Button>
            </div>
          );
        })()}
        {PAID_TIER_CARDS.map((tier) => {
          const L = PLAN_LIMITS[tier.id];
          return (
            <div
              key={tier.id}
              className={`rounded-xl border p-5 sm:p-6 flex flex-col transition-colors ${
                tier.id === "pro" ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/5"
              }`}
            >
              {tier.id === "pro" && (
                <span className="mb-2 w-fit rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Gem className="size-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tier.name}</h3>
                  <p className="text-xl font-bold text-foreground">
                    {tier.priceDisplay}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{tier.blurb}</p>
              <ul className="space-y-2 text-xs text-muted-foreground flex-1 mb-5">
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  {L.carouselsPerMonth} carousels · {L.exportsPerMonth} exports · {L.assets} library images
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  {L.customTemplates} custom templates · {L.aiGenerateCarouselsPerMonth} AI-image carousels / mo
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  Full editor, export ZIP + captions, apply-to-all
                </li>
              </ul>
              <Button size="sm" className="w-full gap-1.5 mt-auto" variant={tier.id === "pro" ? "default" : "outline"} asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
