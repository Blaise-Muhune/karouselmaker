import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getCarousel, getProject, listSlides, listTemplatesForUser, listExportsByCarousel } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SlideGrid, type TemplateWithConfig } from "@/components/carousels/SlideGrid";
import { EditorCaptionSection } from "@/components/editor/EditorCaptionSection";
import { EditorExportSection } from "@/components/editor/EditorExportSection";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { ArrowLeftIcon } from "lucide-react";

export default async function CarouselEditorPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string; carouselId: string }> }>) {
  const { user } = await getUser();
  const { projectId, carouselId } = await params;

  const [carousel, project, slides, templatesRaw, recentExports] = await Promise.all([
    getCarousel(user.id, carouselId),
    getProject(user.id, projectId),
    listSlides(user.id, carouselId),
    listTemplatesForUser(user.id, { includeSystem: true }),
    listExportsByCarousel(user.id, carouselId, 3),
  ]);

  if (!carousel) notFound();
  if (!project) notFound();

  const templates: TemplateWithConfig[] = templatesRaw
    .map((t) => {
      const parsed = templateConfigSchema.safeParse(t.config);
      if (!parsed.success) return null;
      return { ...t, parsedConfig: parsed.data };
    })
    .filter((t): t is TemplateWithConfig => t != null);

  const brandKit: BrandKit = (project.brand_kit as BrandKit) ?? {};

  const slideBackgroundImageUrls: Record<string, string | string[]> = {};
  await Promise.all(
    slides.map(async (s) => {
      const bg = s.background as { mode?: string; storage_path?: string; image_url?: string; images?: { image_url?: string; storage_path?: string }[] } | null;
      if (bg?.mode !== "image") return;
      if (bg.images?.length) {
        const urls: string[] = [];
        for (const img of bg.images) {
          if (img.image_url) urls.push(img.image_url);
          else if (img.storage_path) {
            try {
              urls.push(await getSignedImageUrl("carousel-assets", img.storage_path, 600));
            } catch {
              // skip
            }
          }
        }
        if (urls.length) slideBackgroundImageUrls[s.id] = urls.length === 1 ? urls[0]! : urls;
        return;
      }
      if (bg.image_url) {
        slideBackgroundImageUrls[s.id] = bg.image_url;
        return;
      }
      if (bg.storage_path) {
        try {
          slideBackgroundImageUrls[s.id] = await getSignedImageUrl(
            "carousel-assets",
            bg.storage_path,
            600
          );
        } catch {
          // skip
        }
      }
    })
  );

  const captionVariants = (carousel.caption_variants as {
    short?: string;
    medium?: string;
    spicy?: string;
  }) ?? {};
  const hashtags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/p/${projectId}`}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back to project</span>
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">{carousel.title}</h1>
          </div>
          <span className="text-muted-foreground text-sm">{carousel.status}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slide previews (1080×1080)</CardTitle>
            <CardDescription>
              Click a slide to edit. Drag the grip to reorder. Pick a template per slide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlideGrid
              slides={slides}
              templates={templates}
              brandKit={brandKit}
              projectId={projectId}
              carouselId={carouselId}
              slideBackgroundImageUrls={slideBackgroundImageUrls}
            />
          </CardContent>
        </Card>

        <EditorExportSection
          carouselId={carouselId}
          recentExports={recentExports.map((ex) => ({
            id: ex.id,
            status: ex.status,
            storage_path: ex.storage_path,
            created_at: ex.created_at,
          }))}
        />

        <EditorCaptionSection
          carouselId={carouselId}
          captionVariants={captionVariants}
          hashtags={hashtags}
          editorPath={`/p/${projectId}/c/${carouselId}`}
        />
      </div>
    </div>
  );
}
