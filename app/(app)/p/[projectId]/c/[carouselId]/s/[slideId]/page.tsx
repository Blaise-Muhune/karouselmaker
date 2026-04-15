import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription } from "@/lib/server/subscription";
import { getSlide, getCarousel, getProject, listSlides, listTemplatesForUser, countCarouselsLifetime, getAsset } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { httpsDisplayImageUrl } from "@/lib/server/storage/signedUrlUtils";
import { SlideEditForm, type TemplateWithConfig } from "@/components/editor/SlideEditForm";
import { isAiGeneratedSlideStoragePath } from "@/lib/server/slides/regenerateSlideAiBackground";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";

const BUCKET = "carousel-assets";
function normalizeStoragePathForBucket(path: string | undefined, bucket: string): string | undefined {
  const trimmed = path?.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const bucketPrefix = `${bucket}/`;
  return trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
}

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
  const freeGenerationsUsed = Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS);
  const freeGenerationsLeft = FREE_FULL_ACCESS_GENERATIONS - freeGenerationsUsed;

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
  /** Single slot: AI regen history (storage paths + signed previews) for shuffle in the editor. */
  let initialPrimarySlotStorageChainPaths: string[] | null = null;
  let initialPrimarySlotStorageChainSignedUrls: string[] | null = null;
  let initialImageSource: "brave" | "unsplash" | "google" | "pixabay" | "pexels" | null = null;
  let initialImageSources: ("brave" | "unsplash" | "google" | "pixabay" | "pexels")[] | null = null;
  let initialSecondaryBackgroundImageUrl: string | null = null;
  const bg = slide.background as {
    mode?: string;
    storage_path?: string;
    asset_id?: string;
    image_url?: string;
    image_source?: "brave" | "unsplash" | "google" | "pixabay" | "pexels";
    unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
    secondary_storage_path?: string;
    secondary_image_url?: string;
    images?: { image_url?: string; storage_path?: string; asset_id?: string; source?: "brave" | "google" | "unsplash" | "pixabay" | "pexels"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string }; pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string }; alternates?: string[]; storage_alternates?: string[] }[];
  } | null;
  /** 1 hour expiry for display so preview doesn't break quickly. */
  const DISPLAY_SIGNED_URL_EXPIRY = 3600;
  if (bg?.mode === "image") {
    if (bg.images?.length) {
      const resolvedSlots: Array<{ url: string; source?: "brave" | "unsplash" | "google" | "pixabay" | "pexels" }> = [];
      for (const img of bg.images) {
        const path =
          normalizeStoragePathForBucket(img.storage_path, BUCKET) ||
          (img.asset_id ? normalizeStoragePathForBucket((await getAsset(user.id, img.asset_id))?.storage_path, BUCKET) : undefined);
        const imgSource =
          img.source === "brave" || img.source === "unsplash" || img.source === "google" || img.source === "pixabay" || img.source === "pexels"
            ? img.source
            : undefined;
        if (path) {
          try {
            resolvedSlots.push({ url: await getSignedImageUrl(BUCKET, path, DISPLAY_SIGNED_URL_EXPIRY), source: imgSource });
          } catch {
            const fb = httpsDisplayImageUrl(img.image_url);
            if (fb) resolvedSlots.push({ url: fb, source: imgSource });
          }
        } else {
          const fb = httpsDisplayImageUrl(img.image_url);
          if (fb) resolvedSlots.push({ url: fb, source: imgSource });
        }
      }
      const urls = resolvedSlots.map((s) => s.url);
      if (urls.length === 1) {
        initialBackgroundImageUrl = urls[0] ?? null;
        if (resolvedSlots[0]?.source) initialImageSource = resolvedSlots[0].source;
      } else if (urls.length >= 2) {
        initialBackgroundImageUrls = urls;
        initialImageSources = resolvedSlots.every((s) => s.source != null)
          ? resolvedSlots.map((s) => s.source!)
          : null;
      }
      const img0 = bg.images?.[0] as { storage_path?: string; storage_alternates?: string[] } | undefined;
      const mainSp = img0?.storage_path?.trim();
      const sa = (Array.isArray(img0?.storage_alternates) ? img0.storage_alternates : [])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean);
      const chainPaths = mainSp ? [mainSp, ...sa.filter((p) => p !== mainSp)] : [];
      if (bg.images?.length === 1 && chainPaths.length > 1) {
        const signedChain: string[] = [];
        for (const p of chainPaths) {
          const norm = normalizeStoragePathForBucket(p, BUCKET);
          if (!norm) continue;
          try {
            signedChain.push(await getSignedImageUrl(BUCKET, norm, DISPLAY_SIGNED_URL_EXPIRY));
          } catch {
            signedChain.push("");
          }
        }
        if (signedChain.length === chainPaths.length && signedChain.every((u) => u.length > 0)) {
          initialPrimarySlotStorageChainPaths = chainPaths;
          initialPrimarySlotStorageChainSignedUrls = signedChain;
        }
      }
    } else {
      let pathToUse = normalizeStoragePathForBucket(bg.storage_path, BUCKET);
      if (!pathToUse && bg.asset_id) {
        const asset = await getAsset(user.id, bg.asset_id);
        if (asset?.storage_path) pathToUse = normalizeStoragePathForBucket(asset.storage_path, BUCKET);
      }
      if (pathToUse) {
        try {
          initialBackgroundImageUrl = await getSignedImageUrl(BUCKET, pathToUse, DISPLAY_SIGNED_URL_EXPIRY);
        } catch {
          const fb = httpsDisplayImageUrl(bg.image_url);
          if (fb) {
            initialBackgroundImageUrl = fb;
            if (bg.image_source) initialImageSource = bg.image_source;
          }
        }
      } else {
        const fb = httpsDisplayImageUrl(bg.image_url);
        if (fb) {
          initialBackgroundImageUrl = fb;
          if (bg.image_source) initialImageSource = bg.image_source;
        }
      }
      if (slide.slide_type === "hook") {
        if (bg.secondary_storage_path) {
          try {
            const secPath = normalizeStoragePathForBucket(bg.secondary_storage_path, BUCKET);
            if (!secPath) throw new Error("Invalid secondary storage path");
            initialSecondaryBackgroundImageUrl = await getSignedImageUrl(BUCKET, secPath, DISPLAY_SIGNED_URL_EXPIRY);
          } catch {
            const sfb = httpsDisplayImageUrl(bg.secondary_image_url);
            if (sfb) initialSecondaryBackgroundImageUrl = sfb;
          }
        } else {
          const sfb = httpsDisplayImageUrl(bg.secondary_image_url);
          if (sfb) initialSecondaryBackgroundImageUrl = sfb;
        }
      }
    }
  }

  const carouselExportFormat = (carousel as { export_format?: string }).export_format;
  const carouselExportSize = (carousel as { export_size?: string }).export_size;
  const carouselIncludeFirst = (carousel as { include_first_slide?: boolean }).include_first_slide;
  const carouselIncludeLast = (carousel as { include_last_slide?: boolean }).include_last_slide;

  const genOptsCarousel = (carousel.generation_options ?? {}) as Record<string, unknown>;
  const useAiGenCarousel =
    genOptsCarousel.use_ai_generate === true && genOptsCarousel.use_ai_backgrounds === true;
  let allowRegenerateAiBackground = false;
  if (hasFullAccess && useAiGenCarousel && bg?.mode === "image") {
    const imgs = bg.images;
    const otherSlotsUseStorage =
      Array.isArray(imgs) &&
      imgs.length > 1 &&
      imgs.slice(1).some((slot) => {
        const s = slot as { storage_path?: string; asset_id?: string };
        return !!(s?.storage_path?.trim() || s?.asset_id);
      });
    if (!otherSlotsUseStorage) {
      const path =
        (Array.isArray(imgs) && imgs[0]?.storage_path?.trim()) || bg.storage_path?.trim() || undefined;
      allowRegenerateAiBackground = isAiGeneratedSlideStoragePath(user.id, carouselId, slideId, path ?? null);
    }
  }

  return (
    <div className="min-h-0 flex flex-col p-0 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      {hasFullAccess && !isPro && (
        <div className="shrink-0 px-3 py-1.5">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
            You have full access for your <strong>{FREE_FULL_ACCESS_GENERATIONS} free carousel generations</strong>. {freeGenerationsLeft} {freeGenerationsLeft === 1 ? "generation" : "generations"} left with full access—then upgrade to Pro to keep editing template, background, and all features.
          </div>
        </div>
      )}
      {!hasFullAccess && (
        <div className="shrink-0 px-3 py-1.5">
          <UpgradeBanner
            message="You've used your 3 free generations with full access. Choose a plan to edit template, background, and all carousel features."
            variant="inline"
          />
        </div>
      )}
      <div className="min-h-0 flex flex-col w-full flex-1 lg:overflow-hidden">
        <SlideEditForm
          key={slide.id}
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
          initialExportFormat={
            carouselExportFormat === "png" || carouselExportFormat === "jpeg" || carouselExportFormat === "pdf"
              ? carouselExportFormat
              : "png"
          }
          initialExportSize={carouselExportSize === "1080x1080" || carouselExportSize === "1080x1350" || carouselExportSize === "1080x1920" ? carouselExportSize : "1080x1350"}
          initialIncludeFirstSlide={carouselIncludeFirst !== false}
          initialIncludeLastSlide={carouselIncludeLast !== false}
          initialBackgroundImageUrl={initialBackgroundImageUrl}
          initialBackgroundImageUrls={initialBackgroundImageUrls}
          initialPrimarySlotStorageChainPaths={initialPrimarySlotStorageChainPaths}
          initialPrimarySlotStorageChainSignedUrls={initialPrimarySlotStorageChainSignedUrls}
          initialImageSource={initialImageSource}
          initialImageSources={initialImageSources}
          initialSecondaryBackgroundImageUrl={initialSecondaryBackgroundImageUrl}
          initialMadeWithText={defaultMadeWithSuffix}
          isAdmin={isAdmin(user.email)}
          allowRegenerateAiBackground={allowRegenerateAiBackground}
        />
      </div>
    </div>
  );
}
