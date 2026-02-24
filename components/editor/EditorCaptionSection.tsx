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

type EditorCaptionSectionProps = {
  carouselId: string;
  captionVariants: { short?: string; medium?: string; spicy?: string };
  hashtags: string[];
  unsplashAttributions?: UnsplashAttribution[];
  editorPath: string;
};

export function EditorCaptionSection({
  carouselId,
  captionVariants,
  hashtags,
  unsplashAttributions = [],
  editorPath,
}: EditorCaptionSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<"short" | "medium" | "spicy" | "hashtags" | "credits" | null>(null);

  const copyToClipboard = useCallback(async (text: string, key: "short" | "medium" | "spicy" | "hashtags" | "credits") => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }, []);

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
          <Button variant="ghost" size="sm" className="text-muted-foreground -mr-1 h-8" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
        <div className="mt-3 space-y-4">
          {captionVariants.short && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Short</p>
                <p className="text-sm">{captionVariants.short}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(captionVariants.short!, "short")}
                title="Copy short caption"
              >
                {copied === "short" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {captionVariants.medium && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Medium</p>
                <p className="text-sm">{captionVariants.medium}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(captionVariants.medium!, "medium")}
                title="Copy medium caption"
              >
                {copied === "medium" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {captionVariants.spicy && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Spicy</p>
                <p className="text-sm">{captionVariants.spicy}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0 gap-1.5 h-8"
                onClick={() => copyToClipboard(captionVariants.spicy!, "spicy")}
                title="Copy spicy caption"
              >
                {copied === "spicy" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                Copy
              </Button>
            </div>
          )}
          {!captionVariants.short && !captionVariants.medium && !captionVariants.spicy && (
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
              disabled={!hashtagText}
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
        captionVariants={captionVariants}
        hashtags={hashtags}
        editorPath={editorPath}
      />
    </>
  );
}
