"use client";

import { useEffect, useRef } from "react";

const SLIDES = [
  { title: "5 habits of founders", type: "hook" as const },
  { title: "Wake up at 5am", type: "point" as const },
  { title: "Read 30 min daily", type: "point" as const },
  { title: "3x engagement", type: "result" as const, stat: "Carousels get ↑" },
  { title: "Follow @you", type: "cta" as const },
];

export function HeroCarouselPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = (el.scrollLeft + 1) % (max + 80);
      el.scrollTo({ left: next > max ? 0 : next, behavior: "auto" });
    };
    const id = setInterval(scroll, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-fit animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Mock Instagram / phone frame */}
      <div className="rounded-[2rem] border-[6px] border-foreground/10 bg-foreground/5 p-4 shadow-lg transition-shadow duration-300 hover:shadow-primary/5">
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/20" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-muted/5 p-3">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="shrink-0 w-[140px] sm:w-[160px] aspect-square rounded-xl border border-border/50 bg-linear-to-b from-muted/40 to-muted overflow-hidden snap-start"
            >
              <div className="h-full flex flex-col p-3 sm:p-4 justify-between bg-linear-to-b from-primary/5 to-muted/50">
                <span className="text-[9px] sm:text-[10px] font-medium text-primary uppercase tracking-wider">
                  {slide.type}
                </span>
                <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-3">
                  {slide.title}
                </p>
                {slide.stat && (
                  <span className="text-[10px] text-primary font-medium">{slide.stat}</span>
                )}
              </div>
            </div>
          ))}
        </div>
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
