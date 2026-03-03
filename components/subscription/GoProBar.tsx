"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { Gem, Loader2Icon } from "lucide-react";

/**
 * Slim, non-intrusive bar shown to non-Pro users. One line + Go Pro button.
 */
export function GoProBar() {
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
      <p className="text-muted-foreground text-xs sm:text-sm">
        Unlock more carousels, exports & AI backgrounds with Pro.
      </p>
      <Button
        variant="default"
        size="sm"
        className="shrink-0 gap-1.5 h-8 text-xs sm:text-sm"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? (
          <Loader2Icon className="size-3.5 sm:size-4 animate-spin" />
        ) : (
          <Gem className="size-3.5 sm:size-4" />
        )}
        Go Pro
      </Button>
    </div>
  );
}
