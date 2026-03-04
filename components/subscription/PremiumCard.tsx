import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_DISPLAY, PLAN_LIMITS } from "@/lib/constants";
import { Gem, Check } from "lucide-react";

/**
 * Premium / Pro plan card for auth and landing pages.
 * Matches the design: PREMIUM label, Pro + price, feature list (no voiceover video), CTA.
 * @param onAuthPage When true (login/signup), show "Sign up or log in first, then go Pro" instead of a signup link.
 */
export function PremiumCard({
  className,
  onAuthPage = false,
}: { className?: string; onAuthPage?: boolean }) {
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2 text-center text-xs font-medium uppercase tracking-wider">
        Premium
      </p>
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary/40 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
        <ul className="mb-6 space-y-2.5 text-sm text-muted-foreground">
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
            AI backgrounds, full editor
          </li>
        </ul>
        {onAuthPage ? (
          <p className="text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm">
            Sign up or log in first, then go Pro from the app after you’re in.
          </p>
        ) : (
          <Button size="lg" className="w-full gap-2" asChild>
            <Link href="/signup">
              <Gem className="size-4" />
              Get started with Pro
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
