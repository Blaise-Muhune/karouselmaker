import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription } from "@/lib/server/subscription";
import { getSlide, getCarousel, getProject, listSlides, listTemplatesForUser, countCarouselsLifetime } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { SlideEditForm, type TemplateWithConfig } from "@/components/editor/SlideEditForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";

const BUCKET = "carousel-assets";

const EDIT_TABS = ["text", "layout", "background", "more"] as const;
type EditTab = (typeof EDIT_TABS)[number];
function parseTab(tab: string | null): EditTab | undefined {
  if (tab && EDIT_TABS.includes(tab as EditTab)) return tab as EditTab;
  return undefined;
}

export default async function EditSlidePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string; carouselId: string; slideId: string }>;
  searchParams: Promise<{ tab?: string }>;
}>) {
  const { user } = await getUser();
  const { projectId, carouselId, slideId } = await params;
  const { tab: tabParam } = await searchParams;
  const initialTab = parseTab(tabParam ?? null);

  const { isPro } = await getSubscription(user.id, user.email);
  const lifetimeCarouselCount = await countCarouselsLifetime(user.id);
  const hasFullAccess = isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;

  const [slide, carousel, project, slides, templatesRaw] = await Promise.all([
    getSlide(user.id, slideId),
    getCarousel(user.id, carouselId),
    getProject(user.id, projectId),
    listSlides(user.id, carouselId),
    listTemplatesForUser(user.id, { includeSystem: true }),
  ]);

  const projectBrandKit = project?.brand_kit as { watermark_text?: string } | null | undefined;
  const pageHandle = (projectBrandKit?.watermark_text ?? "").trim().replace(/^@/, "");
  const defaultMadeWithSuffix =
    hasFullAccess && pageHandle ? `follow @${pageHandle}` : "";

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
    images?: { image_url?: string; storage_path?: string; source?: "brave" | "google" | "unsplash"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; alternates?: string[] }[];
  } | null;
  if (bg?.mode === "image") {
    if (bg.images?.length) {
      const urls: string[] = [];
      const sources: ("brave" | "unsplash" | "google")[] = [];
      for (const img of bg.images) {
        if (img.image_url) {
          urls.push(img.image_url);
          sources.push(img.source ?? "brave");
          // One slot with alternates: pass all so the form can show Shuffle
          const alt = (img as { alternates?: string[] }).alternates;
          if (alt?.length) {
            const validAlt = alt.filter((u) => u?.trim() && /^https?:\/\//i.test(u));
            urls.push(...validAlt);
            validAlt.forEach(() => sources.push(img.source ?? "brave"));
          }
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
        initialImageSources = sources.length === urls.length ? sources : urls.map((_, i) => sources[i] ?? sources[0] ?? "brave");
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
  const carouselIncludeFirst = (carousel as { include_first_slide?: boolean }).include_first_slide;
  const carouselIncludeLast = (carousel as { include_last_slide?: boolean }).include_last_slide;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col p-0 md:p-2">
      {!hasFullAccess && (
        <div className="shrink-0 px-4 py-2">
          <UpgradeBanner
            message="You've used your 3 free generations with full access. Upgrade to Pro to edit template, background, and all slide features."
            variant="inline"
          />
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">
        <SlideEditForm
          isPro={hasFullAccess}
          slide={slide}
          slides={slides}
          templates={templates}
          brandKit={brandKit}
          totalSlides={slides.length}
          backHref={backHref}
          editorPath={editorPath}
          carouselId={carouselId}
          projectName={project.name}
          carouselTitle={carousel.title}
          initialEditorTab={initialTab}
          initialExportFormat={carouselExportFormat === "png" || carouselExportFormat === "jpeg" ? carouselExportFormat : "png"}
          initialExportSize={carouselExportSize === "1080x1080" || carouselExportSize === "1080x1350" || carouselExportSize === "1080x1920" ? carouselExportSize : "1080x1350"}
          initialIncludeFirstSlide={carouselIncludeFirst !== false}
          initialIncludeLastSlide={carouselIncludeLast !== false}
          initialBackgroundImageUrl={initialBackgroundImageUrl}
          initialBackgroundImageUrls={initialBackgroundImageUrls}
          initialImageSource={initialImageSource}
          initialImageSources={initialImageSources}
          initialSecondaryBackgroundImageUrl={initialSecondaryBackgroundImageUrl}
          initialMadeWithText={defaultMadeWithSuffix}
          isAdmin={isAdmin(user.email)}
        />
      </div>
    </div>
  );
}
