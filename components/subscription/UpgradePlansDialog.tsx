"use client";

import { useState } from "react";
import type { PaidPlan } from "@/lib/server/db/types";
import { createCheckoutSession, createPostPackCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { PAID_TIER_CARDS, POST_PACK_PRICE_DISPLAY, POST_PACK_SIZE, YEARLY_DISCOUNT_PERCENT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckIcon, Loader2Icon } from "lucide-react";
import type { BillingInterval } from "@/lib/server/stripe/paidPlanFromPriceId";

type UpgradePlansDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
};

export function UpgradePlansDialog({ open: controlledOpen, onOpenChange, trigger }: UpgradePlansDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;
  const [loading, setLoading] = useState<PaidPlan | "post-pack" | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  async function checkout(tier: PaidPlan) {
    setLoading(tier);
    try {
      const result = await createCheckoutSession(tier, billingInterval);
      if ("url" in result) window.location.href = result.url;
      else { setLoading(null); alert(result.error ?? "Failed to start checkout"); }
    } catch {
      setLoading(null);
      alert("Something went wrong");
    }
  }

  async function buyPostPack() {
    setLoading("post-pack");
    try {
      const result = await createPostPackCheckoutSession();
      if ("url" in result) window.location.href = result.url;
      else { setLoading(null); alert(result.error ?? "Failed to start checkout"); }
    } catch {
      setLoading(null);
      alert("Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Make your next post</DialogTitle>
          <DialogDescription>Every plan includes the same organic carousel workflow. Pay for the number of ready-to-publish posts you need.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Free trial:</span> create 3 complete posts, once. Editing, captions, and downloads never use another post.
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/15 p-1" role="group" aria-label="Billing frequency">
          <button type="button" onClick={() => setBillingInterval("monthly")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${billingInterval === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Monthly</button>
          <button type="button" onClick={() => setBillingInterval("yearly")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${billingInterval === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            Yearly <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">save {YEARLY_DISCOUNT_PERCENT}%</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PAID_TIER_CARDS.map((tier) => {
            const featured = tier.id === "growth";
            const monthly = Number(tier.priceDisplay.replace(/[^0-9.]/g, ""));
            const display = billingInterval === "yearly" ? `$${(monthly * (1 - YEARLY_DISCOUNT_PERCENT / 100)).toFixed(2)}` : tier.priceDisplay;
            return (
              <section key={tier.id} className={`flex flex-col rounded-xl border p-5 ${featured ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/5"}`}>
                {featured ? <span className="mb-3 w-fit rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Best for consistent posting</span> : null}
                <h3 className="font-semibold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{display}<span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span></p>
                {billingInterval === "yearly" ? <p className="mt-1 text-[11px] text-muted-foreground">Billed annually</p> : null}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tier.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                  {tier.highlights.map((highlight) => <li key={highlight} className="flex gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />{highlight}</li>)}
                </ul>
                <Button className="mt-6 w-full" variant={featured ? "default" : "outline"} disabled={loading !== null} onClick={() => checkout(tier.id)}>
                  {loading === tier.id ? <Loader2Icon className="size-4 animate-spin" /> : `Choose ${tier.name}`}
                </Button>
              </section>
            );
          })}
        </div>

        <section className="flex flex-col justify-between gap-4 rounded-xl border border-dashed border-border/80 p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-medium text-foreground">Need a few more posts?</h3>
            <p className="mt-1 text-sm text-muted-foreground">{POST_PACK_SIZE} extra post packs for {POST_PACK_PRICE_DISPLAY}. They do not expire.</p>
          </div>
          <Button variant="outline" className="shrink-0" disabled={loading !== null} onClick={buyPostPack}>
            {loading === "post-pack" ? <Loader2Icon className="size-4 animate-spin" /> : `Buy ${POST_PACK_SIZE} posts`}
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
