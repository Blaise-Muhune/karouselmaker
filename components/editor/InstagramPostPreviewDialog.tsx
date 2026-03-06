"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  Loader2Icon,
  MessageCircleIcon,
  SendIcon,
  Share2Icon,
} from "lucide-react";

type CaptionVariants = { short?: string; medium?: string; spicy?: string };

type InstagramPostPreviewDialogProps = {
  carouselId: string;
  captionVariants?: CaptionVariants;
  hashtags?: string[];
  disabled?: boolean;
};

const CAPTION_PICK = (v: CaptionVariants): string =>
  v.medium ?? v.short ?? v.spicy ?? "";

/** Random int in [min, max] inclusive. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Format like Instagram: 1234 → "1,234", 12345 → "12.3K", 123456 → "123K". */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

/** Generate fake engagement numbers (not low). */
function generateFakeCounts(): { likes: number; comments: number } {
  return {
    likes: randomInt(800, 85_000),
    comments: randomInt(45, 1_200),
  };
}

export function InstagramPostPreviewDialog({
  carouselId,
  captionVariants = {},
  hashtags = [],
  disabled = false,
}: InstagramPostPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [fakeCounts, setFakeCounts] = useState<{ likes: number; comments: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const caption = CAPTION_PICK(captionVariants);
  const hashtagLine =
    hashtags.length > 0
      ? hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")
      : "";

  const loadSlideUrls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousel/${carouselId}/render-for-video`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load slides");
      }
      const urls = Array.isArray(data.slideUrls) ? data.slideUrls : [];
      setSlideUrls(urls);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slides");
      setSlideUrls([]);
    } finally {
      setLoading(false);
    }
  }, [carouselId]);

  useEffect(() => {
    if (open && slideUrls.length === 0 && !loading && !error) {
      loadSlideUrls();
    }
  }, [open, slideUrls.length, loading, error, loadSlideUrls]);

  useEffect(() => {
    if (open) setFakeCounts(generateFakeCounts());
  }, [open]);

  const go = (nextIndex: number) => {
    const n = slideUrls.length;
    if (n === 0) return;
    setIndex((i) => Math.max(0, Math.min(n - 1, nextIndex)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  };
  const handleTouchEnd = () => {
    if (touchStart == null || touchEnd == null) return;
    const diff = touchStart - touchEnd;
    const threshold = 50;
    if (diff > threshold) go(index + 1);
    if (diff < -threshold) go(index - 1);
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Share2Icon className="mr-2 size-4" />
          Post view
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Instagram post preview</DialogTitle>
        </DialogHeader>
        <div className="bg-black text-white flex flex-col max-h-[85vh]">
          {/* Mock Instagram header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                IG
              </div>
              <span className="font-semibold text-sm">Instagram</span>
            </div>
          </div>

          {/* Carousel area */}
          <div
            ref={containerRef}
            className="relative aspect-[4/5] bg-black flex overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2Icon className="size-10 animate-spin text-white/80" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/80">
                {error}
              </div>
            ) : slideUrls.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                No slides
              </div>
            ) : (
              <>
                {slideUrls.map((url, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 transition-transform duration-200 ease-out"
                    style={{
                      transform: `translateX(${(i - index) * 100}%)`,
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-contain bg-black"
                      draggable={false}
                    />
                  </div>
                ))}
                {/* Dots */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {slideUrls.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`size-1.5 rounded-full transition-colors ${
                        i === index ? "bg-white" : "bg-white/40"
                      }`}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
                {/* Left/right arrows for laptop */}
                {slideUrls.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-0 shadow-none"
                      onClick={() => go(index - 1)}
                      disabled={index === 0}
                      aria-label="Previous slide"
                    >
                      <ChevronLeftIcon className="size-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-0 shadow-none"
                      onClick={() => go(index + 1)}
                      disabled={index === slideUrls.length - 1}
                      aria-label="Next slide"
                    >
                      <ChevronRightIcon className="size-5" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Like, comment, share, save (Instagram action bar) */}
          {!loading && !error && slideUrls.length > 0 && fakeCounts && (
            <div className="shrink-0 border-b border-white/10">
              <div className="flex items-center px-3 py-2">
                <div className="flex items-center gap-3">
                  <button type="button" className="p-1 text-white hover:opacity-80" aria-label="Like">
                    <HeartIcon className="size-6" />
                  </button>
                  <button type="button" className="p-1 text-white hover:opacity-80" aria-label="Comment">
                    <MessageCircleIcon className="size-6" />
                  </button>
                  <button type="button" className="p-1 text-white hover:opacity-80" aria-label="Share">
                    <SendIcon className="size-6" />
                  </button>
                </div>
                <button type="button" className="p-1 ml-auto text-white hover:opacity-80 shrink-0" aria-label="Save">
                  <BookmarkIcon className="size-6" />
                </button>
              </div>
              <div className="px-3 pb-2 space-y-0.5 text-sm text-white/90">
                <span>{formatCount(fakeCounts.likes)} likes</span>
                {fakeCounts.comments > 0 && (
                  <p className="text-white/70">
                    View all {formatCount(fakeCounts.comments)} comments
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Caption + hashtags (Instagram-style below the image) */}
          <div className="shrink-0 border-t border-white/10 overflow-y-auto max-h-[180px]">
            <div className="p-3 text-sm text-left">
              {(caption || hashtagLine) ? (
                <p className="text-white/95 whitespace-pre-wrap break-words">
                  {caption && <span>{caption} </span>}
                  {hashtagLine && <span className="text-white/70">{hashtagLine}</span>}
                </p>
              ) : (
                <p className="text-white/50">No caption or hashtags yet.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
