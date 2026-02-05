"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { PRO_PRICE_DISPLAY } from "@/lib/constants";
import { SparklesIcon, Loader2Icon } from "lucide-react";

type UpgradeBannerProps = {
  message?: string;
  variant?: "banner" | "inline";
};

export function UpgradeBanner({
  message = "Upgrade to Pro to edit slides, export, and unlock AI backgrounds.",
  variant = "banner",
}: UpgradeBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await createCheckoutSession();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setLoading(false);
        alert(result.error ?? "Failed to start checkout");
      }
    } catch {
      setLoading(false);
      alert("Something went wrong");
    }
  };

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-foreground mb-3 text-sm">{message}</p>
        <Button size="sm" onClick={handleUpgrade} disabled={loading}>
          {loading ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SparklesIcon className="mr-2 size-4" />
          )}
          Upgrade to Pro ({PRO_PRICE_DISPLAY}/mo)
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground text-sm">{message}</p>
        <Button size="sm" onClick={handleUpgrade} disabled={loading}>
          {loading ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SparklesIcon className="mr-2 size-4" />
          )}
          Upgrade to Pro ({PRO_PRICE_DISPLAY}/mo)
        </Button>
      </div>
    </div>
  );
}
