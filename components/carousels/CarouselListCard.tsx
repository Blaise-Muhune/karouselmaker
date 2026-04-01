"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ChevronRightIcon, ImageIcon } from "lucide-react";

const PREVIEW_W = 80;
const PREVIEW_H = 100; // 4:5
const SCALE = PREVIEW_W / 1080;
const PAGE_PEEK = 6; // px of each "page" visible behind the front
const STACK_W = PREVIEW_W + 2 * PAGE_PEEK;

function formatDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type CarouselListCardProps = {
  projectId: string;
  carouselId: string;
  title: string;
  slideCount: number;
  /** Last activity time (regenerate, edits that touch the row, etc.) — used for “Today / Yesterday” and matches list sort. */
  updatedAt: string;
  firstSlideId: string | null;
};

/**
 * Detect JSON/API errors in the iframe. Do not use a short innerText threshold alone: many valid slides
 * have little visible text (image-heavy, short headline) but still render full HTML from `/api/render/slide`.
 */
function iframeLooksLikeError(iframe: HTMLIFrameElement | null): boolean {
  try {
    const doc = iframe?.contentDocument;
    if (!doc?.body) return true;
    const html = doc.documentElement?.innerHTML ?? "";
    if (html.includes("slide-wrap")) return false;
    const text = (doc.body.innerText ?? "").trim();
    if (text.startsWith("{") && /"error"\s*:/.test(text)) return true;
    if (/\b(not found|unauthorized|invalid template|slide not found)\b/i.test(text)) return true;
    if (text.length < 30 && !html.includes("<div")) return true;
    return true;
  } catch {
    return true;
  }
}

export function CarouselListCard({
  projectId,
  carouselId,
  title,
  slideCount,
  updatedAt,
  firstSlideId,
}: CarouselListCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [firstSlideId]);

  const handleIframeLoad = useCallback(() => {
    if (iframeLooksLikeError(iframeRef.current)) setPreviewFailed(true);
  }, []);

  const showPlaceholder = !firstSlideId || previewFailed;

  return (
    <li>
      <Link
        href={`/p/${projectId}/c/${carouselId}`}
        className="flex items-center gap-4 py-3.5 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-lg group"
      >
        {/* Preview stack: pages behind, first frame on top (book-like) */}
        <div
          className="relative shrink-0 overflow-visible"
          style={{ width: STACK_W, height: PREVIEW_H }}
        >
          {/* Back "pages" peeking out from behind */}
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute rounded-lg border border-border/50 bg-muted/50"
              style={{
                width: PREVIEW_W,
                height: PREVIEW_H,
                left: i * PAGE_PEEK,
                top: 0,
                zIndex: i,
              }}
              aria-hidden
            />
          ))}
          {/* Front frame on top */}
          <div
            className="absolute rounded-lg overflow-hidden border border-border/60 bg-muted/30 shadow-sm"
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              left: 2 * PAGE_PEEK,
              top: 0,
              zIndex: 2,
            }}
          >
            {showPlaceholder ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 bg-muted/20">
                <ImageIcon className="size-8" />
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={`/api/render/slide/${firstSlideId}`}
                title={`Preview: ${title}`}
                className="border-0 pointer-events-none block w-full h-full"
                style={{
                  width: 1080,
                  height: 1350,
                  transform: `scale(${SCALE})`,
                  transformOrigin: "0 0",
                }}
                onLoad={handleIframeLoad}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
          <span className="font-medium truncate">{title}</span>
          <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
            {slideCount != null && (
              <span>{slideCount} frame{slideCount !== 1 ? "s" : ""}</span>
            )}
            {formatDate(new Date(updatedAt))}
            <ChevronRightIcon className="size-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
          </span>
        </div>
      </Link>
    </li>
  );
}
