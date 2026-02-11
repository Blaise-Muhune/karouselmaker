import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getSlide, getCarousel, getProject, listSlides, listTemplatesForUser } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { SlideEditForm, type TemplateWithConfig } from "@/components/editor/SlideEditForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";

const BUCKET = "carousel-assets";

export default async function EditSlidePage({
  params,
}: Readonly<{ params: Promise<{ projectId: string; carouselId: string; slideId: string }> }>) {
  const { user } = await getUser();
  const { projectId, carouselId, slideId } = await params;

  const { isPro } = await getSubscription(user.id);

  const [slide, carousel, project, slides, templatesRaw] = await Promise.all([
    getSlide(user.id, slideId),
    getCarousel(user.id, carouselId),
    getProject(user.id, projectId),
    listSlides(user.id, carouselId),
    listTemplatesForUser(user.id, { includeSystem: true }),
  ]);

  if (!slide) notFound();
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
  const backHref = `/p/${projectId}/c/${carouselId}`;
  const editorPath = backHref;

  let initialBackgroundImageUrl: string | null = null;
  let initialBackgroundImageUrls: string[] | null = null;
  let initialImageSource: "brave" | "unsplash" | "google" | null = null;
  let initialImageSources: ("brave" | "unsplash" | "google")[] | null = null;
  let initialSecondaryBackgroundImageUrl: string | null = null;
  const bg = slide.background as {
    mode?: string;
    storage_path?: string;
    image_url?: string;
    image_source?: "brave" | "unsplash" | "google";
    unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
    secondary_storage_path?: string;
    secondary_image_url?: string;
    images?: { image_url?: string; storage_path?: string; source?: "brave" | "google" | "unsplash"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } }[];
  } | null;
  if (bg?.mode === "image") {
    if (bg.images?.length) {
      const urls: string[] = [];
      const sources: ("brave" | "unsplash" | "google")[] = [];
      for (const img of bg.images) {
        if (img.image_url) {
          urls.push(img.image_url);
          if (img.source) sources.push(img.source);
        } else if (img.storage_path) {
          try {
            urls.push(await getSignedImageUrl(BUCKET, img.storage_path, 600));
          } catch {
            // skip
          }
        }
      }
      if (urls.length === 1) {
        initialBackgroundImageUrl = urls[0] ?? null;
        if (sources[0]) initialImageSource = sources[0];
      } else if (urls.length >= 2) {
        initialBackgroundImageUrls = urls;
        if (sources.length === urls.length) initialImageSources = sources;
      }
    } else {
      if (bg.image_url) {
        initialBackgroundImageUrl = bg.image_url;
        if (bg.image_source) initialImageSource = bg.image_source;
      } else if (bg.storage_path) {
        try {
          initialBackgroundImageUrl = await getSignedImageUrl(BUCKET, bg.storage_path, 600);
        } catch {
          // skip
        }
      }
      if (slide.slide_type === "hook") {
        if (bg.secondary_image_url) {
          initialSecondaryBackgroundImageUrl = bg.secondary_image_url;
        } else if (bg.secondary_storage_path) {
          try {
            initialSecondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, bg.secondary_storage_path, 600);
          } catch {
            // skip
          }
        }
      }
    }
  }

  const carouselExportFormat = (carousel as { export_format?: string }).export_format;
  const carouselExportSize = (carousel as { export_size?: string }).export_size;

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {!isPro && (
          <UpgradeBanner
            message="Free plan: Edit headline and text only. Upgrade to Pro to change template, background, and more."
            variant="inline"
          />
        )}
        <SlideEditForm
          isPro={isPro}
          slide={slide}
          slides={slides}
          templates={templates}
          brandKit={brandKit}
          totalSlides={slides.length}
          backHref={backHref}
          editorPath={editorPath}
          carouselId={carouselId}
          initialExportFormat={carouselExportFormat === "png" || carouselExportFormat === "jpeg" ? carouselExportFormat : "png"}
          initialExportSize={carouselExportSize === "1080x1080" || carouselExportSize === "1080x1350" || carouselExportSize === "1080x1920" ? carouselExportSize : "1080x1350"}
          initialBackgroundImageUrl={initialBackgroundImageUrl}
          initialBackgroundImageUrls={initialBackgroundImageUrls}
          initialImageSource={initialImageSource}
          initialImageSources={initialImageSources}
          initialSecondaryBackgroundImageUrl={initialSecondaryBackgroundImageUrl}
        />
      </div>
    </div>
  );
}
