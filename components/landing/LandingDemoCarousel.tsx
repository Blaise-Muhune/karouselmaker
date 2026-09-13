"use client";

import { useEffect, useRef } from "react";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import {
  LANDING_DEMO_BRAND_KIT,
  LANDING_DEMO_SLIDES,
  LANDING_DEMO_TEMPLATE,
} from "@/lib/landing/landingDemoTemplate";

const DESIGN = 1080;

const IDLE_MS = 2500;

/** Transform scale = cardWidth / 1080 for square cards */
const SCALE = {
  hero: "scale-[0.1666666667] sm:scale-[0.2222222222] md:scale-[0.2777777778]",
  strip: "scale-[0.1296296296] sm:scale-[0.1481481481] md:scale-[0.1666666667]",
} as const;

type LandingDemoCarouselProps = {
  /** `hero` = phone preview card widths; `strip` = wider cards under How it works */
  variant: keyof typeof SCALE;
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

const CARD_FRAME = {
  hero: "w-[180px] sm:w-[240px] md:w-[300px]",
  strip: "w-[140px] sm:w-[160px] md:w-[180px]",
} as const;

const CARD_SHELL = {
  hero: "rounded-xl border border-white/10 bg-black/20 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]",
  strip: "rounded-lg sm:rounded-xl border border-border/50 bg-muted/30 ring-1 ring-border/30",
} as const;

/**
 * Horizontal strip of real template previews (same SlidePreview as the editor) for marketing.
 */
export function LandingDemoCarousel({ variant, className, scrollRef: externalScrollRef }: LandingDemoCarouselProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalRef;
  const dragRef = useRef({ startX: 0, startScrollLeft: 0, active: false });
  const userInteractingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setUserInteracting = (value: boolean) => {
    userInteractingRef.current = value;
    if (value) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        userInteractingRef.current = false;
        idleTimerRef.current = null;
      }, IDLE_MS);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onMouseDown = (e: MouseEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      setUserInteracting(true);
      dragRef.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, active: true };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      el.scrollLeft = dragRef.current.startScrollLeft - (e.clientX - dragRef.current.startX);
    };
    const onMouseUp = () => {
      dragRef.current.active = false;
    };
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scroll = () => {
      if (userInteractingRef.current) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = (el.scrollLeft + 1) % (max + 80);
      el.scrollTo({ left: next > max ? 0 : next, behavior: "auto" });
    };
    const id = setInterval(scroll, 80);
    return () => clearInterval(id);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        setUserInteracting(true);
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchStart = () => setUserInteracting(true);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => el.removeEventListener("touchstart", onTouchStart);
  }, [scrollRef]);

  const total = LANDING_DEMO_SLIDES.length;
  const frame = CARD_FRAME[variant];
  const shell = CARD_SHELL[variant];
  const scaleCls = SCALE[variant];

  return (
    <div
      ref={scrollRef}
      className={
        className ??
        "flex gap-2 sm:gap-3 overflow-x-auto pb-2 snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none sm:scrollbar-thin max-sm:[scrollbar-width:none] max-sm:[-ms-overflow-style:none] max-sm:[&::-webkit-scrollbar]:hidden"
      }
    >
      {LANDING_DEMO_SLIDES.map((slide) => (
        <div
          key={slide.slide_index}
          className={`shrink-0 ${frame} ${shell} aspect-square overflow-hidden snap-start pointer-events-none`}
          aria-hidden
        >
          <div className={`origin-top-left ${scaleCls}`} style={{ width: DESIGN, height: DESIGN }}>
            <SlidePreview
              slide={slide}
              templateConfig={LANDING_DEMO_TEMPLATE}
              brandKit={LANDING_DEMO_BRAND_KIT}
              totalSlides={total}
              exportSize="1080x1080"
              showCounterOverride
              showWatermarkOverride={false}
              showMadeWithOverride={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
