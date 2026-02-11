"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CaptionEditModal } from "@/components/editor/CaptionEditModal";

type UnsplashAttribution = {
  photographerName: string;
  photographerUsername: string;
  profileUrl: string;
  unsplashUrl: string;
};

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

  return (
    <>
      <section>
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Caption & hashtags
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground -mr-1" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {captionVariants.short && (
            <div>
              <p className="text-muted-foreground text-xs">Short</p>
              <p className="text-sm">{captionVariants.short}</p>
            </div>
          )}
          {captionVariants.medium && (
            <div>
              <p className="text-muted-foreground text-xs">Medium</p>
              <p className="text-sm">{captionVariants.medium}</p>
            </div>
          )}
          {captionVariants.spicy && (
            <div>
              <p className="text-muted-foreground text-xs">Spicy</p>
              <p className="text-sm">{captionVariants.spicy}</p>
            </div>
          )}
          {!captionVariants.short && !captionVariants.medium && !captionVariants.spicy && (
            <p className="text-muted-foreground text-sm">No caption variants yet.</p>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Hashtags</p>
            {hashtags.length > 0 ? (
              <p className="text-sm">
                {hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No hashtags yet.</p>
            )}
          </div>
          {unsplashAttributions.length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs">Image credits</p>
              <ul className="mt-1 space-y-1 text-sm">
                {unsplashAttributions.map((a) => (
                  <li key={a.photographerUsername}>
                    Photo by{" "}
                    <a
                      href={`https://unsplash.com/@${a.photographerUsername}?utm_source=karouselmaker&utm_medium=referral`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      {a.photographerName}
                    </a>{" "}
                    on{" "}
                    <a
                      href="https://unsplash.com/?utm_source=karouselmaker&utm_medium=referral"
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
