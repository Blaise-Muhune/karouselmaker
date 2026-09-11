"use client";

import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { useRef } from "react";

export function HeroCarouselPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,420px)] sm:max-w-[640px] md:max-w-4xl animate-in fade-in duration-700 slide-in-from-bottom-3">
      <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-border/50 bg-background/70 p-2 shadow-[0_24px_60px_-28px_oklch(0.55_0.17_163_/_0.45)] sm:rounded-[1.5rem] sm:p-3 dark:shadow-[0_24px_60px_-28px_oklch(0.72_0.17_163_/_0.35)]">
        <div className="relative">
          <LandingDemoCarousel
            variant="hero"
            scrollRef={scrollRef}
            className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none sm:scrollbar-thin max-sm:[scrollbar-width:none] max-sm:[-ms-overflow-style:none] max-sm:[&::-webkit-scrollbar]:hidden"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background/80 to-transparent" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground sm:text-sm">
        Organic marketing arc: problem → value → soft product bridge
      </p>
    </div>
  );
}
