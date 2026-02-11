import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getCarousel, getProject, listSlides, listTemplatesForUser, listExportsByCarousel, countExportsThisMonth } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
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
import { CarouselMenuDropdown } from "@/components/carousels/CarouselMenuDropdown";
import { EditorCaptionSection } from "@/components/editor/EditorCaptionSection";
import { EditorExportSection } from "@/components/editor/EditorExportSection";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { ExportFormat, ExportSize } from "@/lib/server/db/types";
import { ArrowLeftIcon } from "lucide-react";

function getExportFormat(c: { export_format?: unknown }): ExportFormat {
  return c.export_format === "jpeg" || c.export_format === "png" ? (c.export_format as ExportFormat) : "png";
}
function getExportSize(c: { export_size?: unknown }): ExportSize {
  return c.export_size === "1080x1080" || c.export_size === "1080x1350" || c.export_size === "1080x1920"
    ? (c.export_size as ExportSize)
    : "1080x1350";
}

export default async function CarouselEditorPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string; carouselId: string }> }>) {
  const { user } = await getUser();
  const { projectId, carouselId } = await params;

  const [carousel, project, slides, templatesRaw, recentExports, subscription, exportCount] = await Promise.all([
    getCarousel(user.id, carouselId),
    getProject(user.id, projectId),
    listSlides(user.id, carouselId),
    listTemplatesForUser(user.id, { includeSystem: true }),
    listExportsByCarousel(user.id, carouselId, 3),
    getSubscription(user.id),
    countExportsThisMonth(user.id),
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

  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);

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

  // Collect Unsplash attributions from slides for credits section
  const unsplashAttributionsMap = new Map<
    string,
    { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }
  >();
  for (const slide of slides) {
    const bg = slide.background as {
      unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
      images?: { unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } }[];
    } | null;
    if (!bg) continue;
    if (bg.unsplash_attribution) {
      const key = bg.unsplash_attribution.photographerUsername;
      if (!unsplashAttributionsMap.has(key)) unsplashAttributionsMap.set(key, bg.unsplash_attribution);
    }
    for (const img of bg.images ?? []) {
      if (img.unsplash_attribution) {
        const key = img.unsplash_attribution.photographerUsername;
        if (!unsplashAttributionsMap.has(key)) unsplashAttributionsMap.set(key, img.unsplash_attribution);
      }
    }
  }
  const unsplashAttributions = Array.from(unsplashAttributionsMap.values());

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {!subscription.isPro && (
          <UpgradeBanner message="Upgrade to Pro to edit slides, export, and unlock AI backgrounds." />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/p/${projectId}`}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back to project</span>
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">{carousel.title}</h1>
            <CarouselMenuDropdown
              carouselId={carouselId}
              projectId={projectId}
              isFavorite={!!carousel.is_favorite}
            />
          </div>
          <span className="text-muted-foreground text-sm">{carousel.status}</span>
        </div>

        <EditorExportSection
          carouselId={carouselId}
          isPro={subscription.isPro}
          exportsUsedThisMonth={exportCount}
          exportFormat={getExportFormat(carousel)}
          exportSize={getExportSize(carousel)}
          recentExports={recentExports.map((ex) => ({
            id: ex.id,
            status: ex.status,
            storage_path: ex.storage_path,
            created_at: ex.created_at,
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Slide previews ({getExportSize(carousel).replace("x", "×")})
            </CardTitle>
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
              exportSize={getExportSize(carousel)}
              isPro={subscription.isPro}
            />
          </CardContent>
        </Card>

        <EditorCaptionSection
          carouselId={carouselId}
          captionVariants={captionVariants}
          hashtags={hashtags}
          unsplashAttributions={unsplashAttributions}
          editorPath={`/p/${projectId}/c/${carouselId}`}
        />
      </div>
    </div>
  );
}
