"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CaptionEditModal } from "@/components/editor/CaptionEditModal";
import { buildLinkedInCarouselCaption } from "@/lib/caption/linkedinPostCaption";
import { CopyIcon, CheckIcon } from "lucide-react";

const UTM = "utm_source=karouselmaker&utm_medium=referral";

type UnsplashAttribution = {
  photographerName: string;
  photographerUsername: string;
  profileUrl: string;
  unsplashUrl: string;
};

/** Same format as export credits (Unsplash API guidelines). */
function formatCreditLine(a: UnsplashAttribution): string {
  return `Photo by ${a.photographerName} (https://unsplash.com/@${a.photographerUsername}?${UTM}) on Unsplash (https://unsplash.com/?${UTM})`;
}

function formatHashtagLine(tags: string[]): string {
  if (tags.length === 0) return "";
  return tags.map((h) => (h.startsWith("#") ? h : `#${h.replace(/^#/, "")}`)).join(" ");
}

/** Combine long caption + hashtags for display/copy (one clipboard paste). */
export function combineCaptionWithHashtags(caption: string, tags: string[]): string {
  const body = caption.trim();
  const tagsLine = formatHashtagLine(tags);
  if (!body) return tagsLine;
  if (!tagsLine) return body;
  return `${body}\n\n${tagsLine}`;
}

/** Supports new (title, medium, long) and legacy (short, spicy) for display. */
export type CaptionVariantsDisplay = {
  title?: string;
  medium?: string;
  long?: string;
  short?: string;
  spicy?: string;
};

type EditorCaptionSectionProps = {
  carouselId: string;
  captionVariants: CaptionVariantsDisplay;
  hashtags: string[];
  unsplashAttributions?: UnsplashAttribution[];
  editorPath: string;
  /** When true (e.g. carousel is generating), disable edit and copy actions. */
  disabled?: boolean;
  /** When LinkedIn, show feed-first tips and combined "Copy for LinkedIn". */
  carouselFor?: "instagram" | "linkedin";
  /** Show a loading state instead of “No caption variants yet” (e.g. recovery / late hydration). */
  captionHydrating?: boolean;
};

export function EditorCaptionSection({
  carouselId,
  captionVariants,
  hashtags,
  unsplashAttributions = [],
  editorPath,
  disabled = false,
  carouselFor,
  captionHydrating = false,
}: EditorCaptionSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<"title" | "caption" | "credits" | "linkedin" | null>(null);
  const isLinkedIn = carouselFor === "linkedin";

  const copyToClipboard = useCallback(async (text: string, key: "title" | "caption" | "credits" | "linkedin") => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }, []);

  const titleText = captionVariants.title ?? captionVariants.short ?? "";
  const longText = captionVariants.long ?? captionVariants.spicy ?? captionVariants.medium ?? "";
  const captionWithHashtags = combineCaptionWithHashtags(longText, hashtags);
  const creditsText =
    unsplashAttributions.length > 0 ? unsplashAttributions.map(formatCreditLine).join("\n") : "";

  const linkedInCombined = buildLinkedInCarouselCaption({
    caption_variants: {
      title: titleText || undefined,
      long: longText || undefined,
    },
    hashtags,
  });

  return (
    <>
      <section className="rounded-xl border border-border/70 bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <details className="group min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground marker:content-none">
              Caption & hashtags
              <span className="truncate text-xs font-normal text-muted-foreground">
                {captionWithHashtags ? "Ready to copy" : captionHydrating ? "Finishing…" : "Not ready yet"}
              </span>
            </summary>
            <div className="mt-3 space-y-4">
          {isLinkedIn && (
            <p className="text-muted-foreground text-sm rounded-md border border-border bg-muted/40 px-3 py-2">
              <strong className="text-foreground">LinkedIn:</strong> Paste the document carousel first, then this caption. The{" "}
              <span className="text-foreground font-medium">first line</span> is what people see before &quot;see more&quot;—keep the hook there.{" "}
              Use <span className="text-foreground font-medium">3–5</span> niche hashtags.
            </p>
          )}
          {isLinkedIn && linkedInCombined.trim() && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-sm text-foreground font-medium">Ready to paste on LinkedIn</p>
              <Button
                variant="default"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => copyToClipboard(linkedInCombined, "linkedin")}
                disabled={disabled || !linkedInCombined.trim()}
                title="Copy opening line + body + hashtags for your LinkedIn post"
              >
                {copied === "linkedin" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy for LinkedIn
              </Button>
            </div>
          )}
          {titleText && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  {isLinkedIn ? "First line (feed preview)" : "Title (SEO)"}
                </p>
                <p className="text-sm">{titleText}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(titleText, "title")}
                title={isLinkedIn ? "Copy first line" : "Copy title"}
                disabled={disabled}
              >
                {copied === "title" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {captionWithHashtags && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  {isLinkedIn ? "Caption (includes hashtags)" : "Caption"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{captionWithHashtags}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(captionWithHashtags, "caption")}
                title="Copy caption and hashtags"
                disabled={disabled}
              >
                {copied === "caption" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {!titleText && !captionWithHashtags && (
            captionHydrating ? (
              <div className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                <span className="inline-block size-4 animate-pulse rounded-full bg-primary/40" aria-hidden />
                Finishing captions… refresh if this stays empty.
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No caption yet.</p>
            )
          )}

          {unsplashAttributions.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Image credits</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {unsplashAttributions.map((a) => (
                    <li key={a.photographerUsername}>
                      Photo by{" "}
                      <a
                        href={`https://unsplash.com/@${a.photographerUsername}?${UTM}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        {a.photographerName}
                      </a>{" "}
                      on{" "}
                      <a
                        href={`https://unsplash.com/?${UTM}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Unsplash
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(creditsText, "credits")}
                title="Copy credits"
                disabled={disabled}
              >
                {copied === "credits" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
            </div>
          </details>
          <Button variant="ghost" size="sm" className="text-muted-foreground -mr-1 h-8 shrink-0" onClick={() => setEditOpen(true)} disabled={disabled}>
            Edit
          </Button>
        </div>
      </section>

      <CaptionEditModal
        key={editOpen ? "open" : "closed"}
        open={editOpen}
        onOpenChange={setEditOpen}
        carouselId={carouselId}
        captionVariants={{
          title: titleText || undefined,
          long: longText || undefined,
        }}
        hashtags={hashtags}
        editorPath={editorPath}
        carouselFor={carouselFor}
      />
    </>
  );
}
