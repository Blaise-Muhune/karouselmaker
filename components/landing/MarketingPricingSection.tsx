import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { PAID_TIER_CARDS, POST_PACK_PRICE_DISPLAY, POST_PACK_SIZE, YEARLY_DISCOUNT_PERCENT } from "@/lib/constants";

type MarketingPricingSectionProps = { sectionId?: string; className?: string };

export function MarketingPricingSection({ sectionId = "pricing", className }: MarketingPricingSectionProps) {
  return (
    <div id={sectionId} className={className ?? "scroll-reveal [content-visibility:auto] mx-auto mt-20 w-full max-w-6xl px-4 sm:mt-28 sm:px-6 motion-reduce:animate-none"}>
      <div className="max-w-xl">
        <h2 id="pricing-heading" className="font-[family-name:var(--font-landing-display)] text-3xl font-normal tracking-tight text-foreground sm:text-4xl">Pay for posts, not design features</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Every post includes the topic, slides, caption, hashtags, stock images, editing, and downloads.</p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 md:grid-cols-3">
        <article className="flex flex-col bg-background p-6 sm:p-7">
          <p className="text-sm font-medium text-foreground">Free trial</p>
          <p className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl tracking-tight text-foreground">$0</p>
          <p className="mt-2 text-sm text-muted-foreground">See the complete workflow before you pay.</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
            <li>3 ready-to-post carousels, once</li>
            <li>Captions, hashtags, and stock images</li>
            <li>Keep editing and downloading forever</li>
          </ul>
          <Button size="sm" className="mt-8 w-full" variant="outline" asChild><Link href="/signup">Start free</Link></Button>
        </article>
        {PAID_TIER_CARDS.map((tier) => {
          const featured = tier.id === "growth";
          return (
            <article key={tier.id} className={`flex flex-col p-6 sm:p-7 ${featured ? "bg-primary text-primary-foreground" : "bg-background"}`}>
              <div className="flex items-baseline justify-between gap-2"><p className={`text-sm font-medium ${featured ? "text-primary-foreground" : "text-foreground"}`}>{tier.name}</p>{featured ? <span className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/80">Most popular</span> : null}</div>
              <p className={`mt-3 font-[family-name:var(--font-landing-display)] text-3xl tracking-tight ${featured ? "text-primary-foreground" : "text-foreground"}`}>{tier.priceDisplay}<span className={`ml-1 text-sm font-sans ${featured ? "text-primary-foreground/75" : "text-muted-foreground"}`}>/mo</span></p>
              <p className={`mt-2 text-sm ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{tier.blurb}</p>
              <ul className={`mt-6 flex-1 space-y-2.5 text-sm ${featured ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{tier.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
              <Button size="sm" className="mt-8 w-full" variant={featured ? "secondary" : "outline"} asChild><Link href="/signup">Choose {tier.name}</Link></Button>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">Save {YEARLY_DISCOUNT_PERCENT}% with annual billing. Need a burst of content? Add {POST_PACK_SIZE} more posts for {POST_PACK_PRICE_DISPLAY}.</p>
    </div>
  );
}
