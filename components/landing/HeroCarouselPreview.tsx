"use client";

import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { useRef } from "react";

export function HeroCarouselPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,380px)] sm:max-w-[560px] md:max-w-3xl animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className="rounded-[2rem] border-[6px] border-foreground/10 bg-foreground/5 p-3 sm:p-4 shadow-lg transition-shadow duration-300 hover:shadow-primary/5 min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <div className="h-1.5 w-24 rounded-full bg-muted-foreground/20 min-w-0" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">Real template preview</span>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/5 p-2 sm:p-3 min-w-0 overflow-hidden">
          <div className="relative">
            <LandingDemoCarousel
              variant="hero"
              scrollRef={scrollRef}
              className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none sm:scrollbar-thin max-sm:[scrollbar-width:none] max-sm:[-ms-overflow-style:none] max-sm:[&::-webkit-scrollbar]:hidden"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-background/60 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background/60 to-transparent" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
          {["Template locked", "Live preview", "Export ready"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1.5 rounded-full bg-primary/30 w-4 animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
