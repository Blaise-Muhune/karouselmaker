import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CREATOR_PRICE_DISPLAY, GROWTH_PRICE_DISPLAY, PLAN_LIMITS } from "@/lib/constants";
import { Gem, Check } from "lucide-react";

/**
 * Paid plans summary for auth pages. Full checkout happens in-app after sign-in.
 */
export function PremiumCard({
  className,
  onAuthPage = false,
}: { className?: string; onAuthPage?: boolean }) {
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2 text-center text-xs font-medium uppercase tracking-wider">
        Plans
      </p>
      <div className="rounded-xl border border-border/60 bg-muted/5 p-5 transition-colors sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gem className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">Free · Creator · Growth</h3>
            <p className="text-sm text-muted-foreground">
              $0 → {CREATOR_PRICE_DISPLAY} → {GROWTH_PRICE_DISPLAY}/mo
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs mb-4">
          Same organic marketing workflow on every tier. Choose how many ready-to-post carousels you need each month.
        </p>
        <ul className="mb-6 space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-primary" />
            Up to {PLAN_LIMITS.growth.carouselsPerMonth} organic carousels/mo on Growth
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-primary" />
            Export ZIP + captions for Instagram & TikTok
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-primary" />
            Niche + offer projects, templates & light edit
          </li>
        </ul>
        {onAuthPage ? (
          <p className="text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm">
            Sign up or log in first, then pick a plan from the app.
          </p>
        ) : (
          <Button size="lg" className="w-full gap-2" asChild>
            <Link href="/signup">
              <Gem className="size-4" />
              Start marketing
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
