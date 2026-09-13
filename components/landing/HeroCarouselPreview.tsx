"use client";

import { LandingDemoCarousel } from "@/components/landing/LandingDemoCarousel";
import { useRef } from "react";

/**
 * Full-bleed product surface for the marketing hero — no inset “media card”,
 * no floating captions on the slides.
 */
export function HeroCarouselPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative w-full animate-in fade-in duration-700 slide-in-from-bottom-2 motion-reduce:animate-none">
      <LandingDemoCarousel
        variant="hero"
        scrollRef={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-1 pt-1 snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none sm:gap-4 sm:px-6 sm:scrollbar-thin max-sm:[scrollbar-width:none] max-sm:[-ms-overflow-style:none] max-sm:[&::-webkit-scrollbar]:hidden md:px-8"
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-[oklch(0.16_0.03_163)] to-transparent sm:w-12"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-[oklch(0.16_0.03_163)] to-transparent sm:w-12"
        aria-hidden
      />
    </div>
  );
}
