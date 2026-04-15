"use client";

import { useRouter } from "next/navigation";
import type { Slide } from "@/lib/server/db/types";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { SlideEditorModal, type TemplateWithConfig } from "@/components/editor/SlideEditorModal";

type SlideEditFormProps = {
  isPro: boolean;
  slide: Slide;
  slides: Slide[];
  templates: TemplateWithConfig[];
  brandKit: BrandKit;
  totalSlides: number;
  backHref: string;
  editorPath: string;
  carouselId: string;
  projectName: string;
  carouselTitle: string;
  initialEditorTab?: "text" | "layout" | "background" | "more";
  initialExportFormat?: "png" | "jpeg" | "pdf";
  initialExportSize?: "1080x1080" | "1080x1350" | "1080x1920";
  initialIncludeFirstSlide?: boolean;
  initialIncludeLastSlide?: boolean;
  initialBackgroundImageUrl?: string | null;
  initialBackgroundImageUrls?: string[] | null;
  initialPrimarySlotStorageChainPaths?: string[] | null;
  initialPrimarySlotStorageChainSignedUrls?: string[] | null;
  initialImageSource?: "brave" | "unsplash" | "google" | "pixabay" | "pexels" | null;
  initialImageSources?: ("brave" | "unsplash" | "google" | "pixabay" | "pexels")[] | null;
  initialSecondaryBackgroundImageUrl?: string | null;
  initialMadeWithText?: string;
  isAdmin?: boolean;
  allowRegenerateAiBackground?: boolean;
};

export type { TemplateWithConfig };

export function SlideEditForm({
  slide,
  templates,
  brandKit,
  totalSlides,
  backHref,
  editorPath,
  initialBackgroundImageUrl,
  initialBackgroundImageUrls,
}: SlideEditFormProps) {
  const router = useRouter();

  const previewImage =
    initialBackgroundImageUrl ??
    (Array.isArray(initialBackgroundImageUrls) && initialBackgroundImageUrls.length > 0
      ? initialBackgroundImageUrls[0]
      : null);

  return (
    <SlideEditorModal
      open
      onOpenChange={(open) => {
        if (!open) router.push(backHref);
      }}
      slide={slide}
      templates={templates}
      brandKit={brandKit}
      totalSlides={totalSlides}
      editorPath={editorPath}
      onSaved={() => {
        router.push(backHref);
      }}
      initialBackgroundImageUrl={previewImage}
    />
  );
}
