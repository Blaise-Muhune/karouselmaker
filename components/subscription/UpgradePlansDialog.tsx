"use client";

import { useState } from "react";
import type { PaidPlan } from "@/lib/server/db/types";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { PAID_TIER_CARDS, PLAN_LIMITS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2Icon } from "lucide-react";
import type { BillingInterval } from "@/lib/server/stripe/paidPlanFromPriceId";

type UpgradePlansDialogProps = {
  /** When set with `onOpenChange`, dialog is controlled (no trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (uncontrolled mode). */
  trigger?: React.ReactNode;
};

export function UpgradePlansDialog({ open: controlledOpen, onOpenChange, trigger }: UpgradePlansDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const [loadingTier, setLoadingTier] = useState<PaidPlan | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  async function checkout(tier: PaidPlan) {
    setLoadingTier(tier);
    try {
      const result = await createCheckoutSession(tier, billingInterval);
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setLoadingTier(null);
        alert(result.error ?? "Failed to start checkout");
      }
    } catch {
      setLoadingTier(null);
      alert("Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a plan</DialogTitle>
          <DialogDescription>
            Starter, Pro, and Studio are solo plans—same features, higher limits on each step up. Cancel anytime in
            billing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/15 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              billingInterval === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("yearly")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              billingInterval === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Yearly
            <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
              save 15%
            </span>
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PAID_TIER_CARDS.map((tier) => {
            const limits = PLAN_LIMITS[tier.id];
            const monthly = Number(tier.priceDisplay.replace(/[^0-9.]/g, ""));
            const yearlyMonthly = Math.round(monthly * 0.85);
            const priceDisplay = billingInterval === "yearly" ? `$${yearlyMonthly}` : tier.priceDisplay;
            return (
              <div
                key={tier.id}
                className={`flex flex-col rounded-xl border p-4 ${tier.id === "pro" ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/5"}`}
              >
                {tier.id === "pro" && (
                  <span className="mb-2 w-fit rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Popular
                  </span>
                )}
                <h3 className="font-semibold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {priceDisplay}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                {billingInterval === "yearly" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Billed yearly</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground leading-snug">{tier.blurb}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                  <li>
                    {limits.carouselsPerMonth} carousels / mo · {limits.exportsPerMonth} exports / mo
                  </li>
                  <li>
                    {limits.assets} library images · {limits.customTemplates} custom templates
                  </li>
                  <li>{limits.aiGenerateCarouselsPerMonth} AI-image carousels / mo</li>
                  <li>
                    {limits.maxProjectStyleReferenceAssets} project style refs · {limits.maxUgcAvatarReferenceAssets}{" "}
                    UGC face refs
                  </li>
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={tier.id === "pro" ? "default" : "outline"}
                  disabled={loadingTier !== null}
                  onClick={() => checkout(tier.id)}
                >
                  {loadingTier === tier.id ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    `Continue with ${tier.name}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
