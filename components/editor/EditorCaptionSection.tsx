"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Caption & hashtags</CardTitle>
            <CardDescription>
              Short, medium, and spicy caption variants. Edit to customize.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit caption
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {captionVariants.short && (
            <div>
              <p className="text-muted-foreground text-xs font-medium">Short</p>
              <p className="text-sm">{captionVariants.short}</p>
            </div>
          )}
          {captionVariants.medium && (
            <div>
              <p className="text-muted-foreground text-xs font-medium">Medium</p>
              <p className="text-sm">{captionVariants.medium}</p>
            </div>
          )}
          {captionVariants.spicy && (
            <div>
              <p className="text-muted-foreground text-xs font-medium">Spicy</p>
              <p className="text-sm">{captionVariants.spicy}</p>
            </div>
          )}
          {!captionVariants.short && !captionVariants.medium && !captionVariants.spicy && (
            <p className="text-muted-foreground text-sm">No caption variants yet.</p>
          )}
          <div>
            <p className="text-muted-foreground text-xs font-medium">Hashtags</p>
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
              <p className="text-muted-foreground text-xs font-medium">Image credits (Unsplash)</p>
              <ul className="text-sm space-y-1 mt-1">
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
        </CardContent>
      </Card>

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
