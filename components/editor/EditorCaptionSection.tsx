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

/** Supports new (title, medium, long) and legacy (short, medium, spicy) for display. */
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
};

export function EditorCaptionSection({
  carouselId,
  captionVariants,
  hashtags,
  unsplashAttributions = [],
  editorPath,
  disabled = false,
  carouselFor,
}: EditorCaptionSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<"title" | "medium" | "long" | "hashtags" | "credits" | "linkedin" | null>(null);
  const isLinkedIn = carouselFor === "linkedin";

  const copyToClipboard = useCallback(async (text: string, key: "title" | "medium" | "long" | "hashtags" | "credits" | "linkedin") => {
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
  const mediumText = captionVariants.medium ?? "";
  const longText = captionVariants.long ?? captionVariants.spicy ?? "";
  const hashtagText = hashtags.length > 0 ? hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ") : "";
  const creditsText =
    unsplashAttributions.length > 0 ? unsplashAttributions.map(formatCreditLine).join("\n") : "";

  const linkedInCombined = buildLinkedInCarouselCaption({
    caption_variants: {
      title: titleText || undefined,
      medium: mediumText || undefined,
      long: longText || undefined,
    },
    hashtags,
  });

  return (
    <>
      <section>
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Caption & hashtags
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground -mr-1 h-8" onClick={() => setEditOpen(true)} disabled={disabled}>
            Edit
          </Button>
        </div>
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
          {mediumText && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Medium caption (engagement)</p>
                <p className="text-sm">{mediumText}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(mediumText, "medium")}
                title="Copy medium caption"
                disabled={disabled}
              >
                {copied === "medium" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {longText && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  {isLinkedIn ? "Longer variant (optional)" : "Long caption"}
                </p>
                <p className="text-sm">{longText}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(longText, "long")}
                title="Copy long caption"
                disabled={disabled}
              >
                {copied === "long" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {!titleText && !mediumText && !longText && (
            <p className="text-muted-foreground text-sm">No caption variants yet.</p>
          )}

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">{isLinkedIn ? "Hashtags (3–5 recommended)" : "Hashtags"}</p>
              {hashtags.length > 0 ? (
                <p className="text-sm wrap-break-word">{hashtagText}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No hashtags yet.</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground shrink-0 gap-1.5 h-8"
              onClick={() => copyToClipboard(hashtagText, "hashtags")}
              disabled={disabled || !hashtagText}
              title="Copy hashtags"
            >
              {copied === "hashtags" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              Copy
            </Button>
          </div>

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
      </section>

      <CaptionEditModal
        key={editOpen ? "open" : "closed"}
        open={editOpen}
        onOpenChange={setEditOpen}
        carouselId={carouselId}
        captionVariants={{
          title: titleText || undefined,
          medium: mediumText || undefined,
          long: longText || undefined,
        }}
        hashtags={hashtags}
        editorPath={editorPath}
        carouselFor={carouselFor}
      />
    </>
  );
}
