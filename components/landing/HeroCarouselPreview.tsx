"use client";

import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { useRef } from "react";

export function HeroCarouselPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,340px)] sm:max-w-[420px] md:max-w-xl lg:max-w-2xl animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Mock Instagram / phone frame */}
      <div className="rounded-[2rem] border-[6px] border-foreground/10 bg-foreground/5 p-3 sm:p-4 shadow-lg transition-shadow duration-300 hover:shadow-primary/5 min-w-0">
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/20 min-w-0" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/5 p-2 sm:p-3 min-w-0 overflow-hidden">
          <LandingDemoCarousel variant="hero" scrollRef={scrollRef} />
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
