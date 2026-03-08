"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CaptionEditModal } from "@/components/editor/CaptionEditModal";
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
};

export function EditorCaptionSection({
  carouselId,
  captionVariants,
  hashtags,
  unsplashAttributions = [],
  editorPath,
  disabled = false,
}: EditorCaptionSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<"title" | "medium" | "long" | "hashtags" | "credits" | null>(null);

  const copyToClipboard = useCallback(async (text: string, key: "title" | "medium" | "long" | "hashtags" | "credits") => {
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
          {titleText && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Title (SEO)</p>
                <p className="text-sm">{titleText}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(titleText, "title")}
                title="Copy title"
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
                <p className="text-muted-foreground text-xs">Long caption</p>
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
              <p className="text-muted-foreground text-xs">Hashtags</p>
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
      />
    </>
  );
}
