"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";
import { Gem } from "lucide-react";

/**
 * Slim bar for users without a paid plan. Opens plan picker (Starter / Pro / Studio).
 */
export function GoProBar() {
  const [plansOpen, setPlansOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
        <p className="text-muted-foreground text-xs sm:text-sm">
          Unlock more carousels, exports, and AI-generated backgrounds with a paid plan.
        </p>
        <Button
          variant="default"
          size="sm"
          className="shrink-0 gap-1.5 h-8 text-xs sm:text-sm"
          onClick={() => setPlansOpen(true)}
        >
          <Gem className="size-3.5 sm:size-4" />
          View plans
        </Button>
      </div>
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}
