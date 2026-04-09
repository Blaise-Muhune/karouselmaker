"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gem } from "lucide-react";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";

type UpgradeBannerProps = {
  message?: string;
  variant?: "banner" | "inline";
};

export function UpgradeBanner({
  message = "Upgrade to unlock more carousels, exports, AI-generated images, and editor features.",
  variant = "banner",
}: UpgradeBannerProps) {
  const [plansOpen, setPlansOpen] = useState(false);

  const cta = (
    <Button size="sm" onClick={() => setPlansOpen(true)}>
      <Gem className="mr-2 size-4" />
      View plans
    </Button>
  );

  if (variant === "inline") {
    return (
      <>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-foreground mb-3 text-sm">{message}</p>
          {cta}
        </div>
        <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-foreground text-sm">{message}</p>
          {cta}
        </div>
      </div>
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}
