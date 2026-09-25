import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";

/** Ensure router.refresh() always gets fresh data so generating→done transition is visible. */
export const dynamic = "force-dynamic";
import { getSubscription, getEffectivePlanLimits } from "@/lib/server/subscription";
import { getCarousel, getProject, listSlides, listTemplatesForUser, listFavoriteTemplateIds, listExportsByCarousel, countExportsThisMonth, getAsset, countCarouselsLifetime, getPlatformConnection, listTikTokScheduledPosts } from "@/lib/server/db";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { httpsDisplayImageUrl } from "@/lib/server/storage/signedUrlUtils";
import { resolveTemplatePreviewImageUrls } from "@/lib/server/templates/resolveTemplatePreviewImageUrls";
import { Button } from "@/components/ui/button";
import { SlideGrid, type TemplateWithConfig } from "@/components/carousels/SlideGrid";
import { CarouselMenuDropdown } from "@/components/carousels/CarouselMenuDropdown";
import { ShuffleCarouselBackgroundsButton } from "@/components/carousels/ShuffleCarouselBackgroundsButton";
import { EditorCaptionSection } from "@/components/editor/EditorCaptionSection";
import { EditorExportSection } from "@/components/editor/EditorExportSection";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { ExportFormat, ExportSize } from "@/lib/server/db/types";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { cn, slugifyForFilename } from "@/lib/utils";
import { GenerationPartialBanner } from "@/components/carousels/GenerationPartialBanner";
import {
  CarouselGeneratingPage,
  CarouselGenerationFailedPage,
} from "@/components/carousels/CarouselGeneratingTrigger";
import { PostToInstagramPanel } from "@/components/instagram/PostToInstagramPanel";
import { PostToTikTokPanel } from "@/components/tiktok/PostToTikTokPanel";
import { getInstagramLinkedAccounts, getSelectedInstagramAccount } from "@/lib/instagram/accounts";
import { ArrowLeftIcon, SparklesIcon } from "lucide-react";

function normalizeStoragePathForBucket(path: string | undefined, bucket: string): string | undefined {
  const trimmed = path?.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const bucketPrefix = `${bucket}/`;
  return trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
}

function getExportFormat(c: { export_format?: unknown }): ExportFormat {
  return c.export_format === "jpeg" || c.export_format === "png" || c.export_format === "pdf"
    ? (c.export_format as ExportFormat)
    : "png";
}
function getExportSize(c: { export_size?: unknown }): ExportSize {
  return c.export_size === "1080x1080" || c.export_size === "1080x1350" || c.export_size === "1080x1920"
    ? (c.export_size as ExportSize)
    : "1080x1350";
}

export default async function CarouselEditorPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string; carouselId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const { user } = await getUser();
  const userIsAdmin = isAdmin(user.email ?? null);
  const { projectId, carouselId } = await params;
  const resolvedSearchParams = await searchParams;
  const showGenerationPartial = resolvedSearchParams?.generation === "partial";

  const [carousel, project, slides, templatesRaw, recentExports, subscription, exportCount, lifetimeCarouselCount, limits, favoriteIds, tiktokConnection, instagramConnection, tiktokSchedules] =
    await Promise.all([
      getCarousel(user.id, carouselId),
      getProject(user.id, projectId),
      listSlides(user.id, carouselId),
      // Include hidden configs so existing slides keep their design; the picker filters them for non-admins.
      listTemplatesForUser(user.id, { includeSystem: true, includeHidden: true }),
      listExportsByCarousel(user.id, carouselId, 3),
      getSubscription(user.id, user.email),
      countExportsThisMonth(user.id),
      countCarouselsLifetime(user.id),
      getEffectivePlanLimits(user.id, user.email),
      listFavoriteTemplateIds(user.id),
      getPlatformConnection(user.id, "tiktok"),
      getPlatformConnection(user.id, "instagram"),
      listTikTokScheduledPosts(user.id, carouselId),
    ]);

  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsLeft = hasFullAccess && !subscription.isPro
    ? FREE_FULL_ACCESS_GENERATIONS - Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS)
    : 0;

  if (!carousel) notFound();
  if (!project) notFound();

  const instagramAccounts = instagramConnection
    ? getInstagramLinkedAccounts(instagramConnection).map((a) => ({
        igUserId: a.igUserId,
        username: a.username,
        pageName: a.pageName,
      }))
    : [];
  const selectedInstagram = instagramConnection ? getSelectedInstagramAccount(instagramConnection) : null;

  // Show loading immediately when generating; skip heavy work so refresh gets fresh status.
  if (carousel.status === "generating") {
    return <CarouselGeneratingPage carouselId={carouselId} projectId={projectId} />;
  }

  const generationErrorEarly = (() => {
    const o = (carousel.generation_options ?? {}) as Record<string, unknown>;
    return typeof o.generation_error === "string" && o.generation_error.trim()
      ? o.generation_error.trim()
      : null;
  })();
  if (carousel.status === "draft" && generationErrorEarly) {
    return (
      <CarouselGenerationFailedPage
        projectId={projectId}
        carouselId={carouselId}
        error={generationErrorEarly}
      />
    );
  }

  const favoriteIdSet = new Set(favoriteIds);
  const parsedTemplates = templatesRaw.flatMap((t) => {
    const parsed = templateConfigSchema.safeParse(t.config);
    return parsed.success ? [{ template: t, config: parsed.data }] : [];
  });
  const templatePreviewUrls = await Promise.all(
    parsedTemplates.map(({ config }) => resolveTemplatePreviewImageUrls(user.id, config))
  );
  const templates: TemplateWithConfig[] = parsedTemplates.map(({ template: t, config }, index) => ({
    ...t,
    parsedConfig: config,
    isFavorite: favoriteIdSet.has(t.id),
    is_hidden: t.is_hidden === true,
    previewImageUrls: templatePreviewUrls[index],
  }));

  const brandKit: BrandKit = await resolveBrandKitLogo(project.brand_kit as Record<string, unknown> | null);

  /** 1 hour expiry for display so thumbnails don't break quickly. */
  const DISPLAY_SIGNED_URL_EXPIRY = 3600;
  const slideBackgroundImageUrls: Record<string, string | string[]> = {};
  await Promise.all(
    slides.map(async (s) => {
      const bg = s.background as { mode?: string; storage_path?: string; image_url?: string; asset_id?: string; images?: { image_url?: string; storage_path?: string; asset_id?: string }[] } | null;
      if (bg?.mode !== "image") return;
      if (bg.images?.length) {
        const urls: string[] = [];
        for (const img of bg.images) {
          let resolved = "";
          const path =
            normalizeStoragePathForBucket(img.storage_path, "carousel-assets") ||
            (img.asset_id
              ? normalizeStoragePathForBucket((await getAsset(user.id, img.asset_id))?.storage_path, "carousel-assets")
              : undefined);
          if (path) {
            try {
              resolved = await getSignedImageUrl("carousel-assets", path, DISPLAY_SIGNED_URL_EXPIRY);
            } catch {
              resolved = httpsDisplayImageUrl(img.image_url) ?? "";
            }
          } else {
            resolved = httpsDisplayImageUrl(img.image_url) ?? "";
          }
          urls.push(resolved);
        }
        const any = urls.some((u) => u.length > 0);
        if (any) {
          slideBackgroundImageUrls[s.id] = bg.images.length === 1 ? urls[0]! : urls;
          return;
        }
        /* `images[]` present but no slot resolved — fall through to top-level asset_id / image_url */
      }
      let pathToUse = normalizeStoragePathForBucket(bg.storage_path, "carousel-assets");
      if (!pathToUse && bg.asset_id) {
        const asset = await getAsset(user.id, bg.asset_id);
        if (asset?.storage_path) pathToUse = normalizeStoragePathForBucket(asset.storage_path, "carousel-assets");
      }
      if (pathToUse) {
        try {
          slideBackgroundImageUrls[s.id] = await getSignedImageUrl(
            "carousel-assets",
            pathToUse,
            DISPLAY_SIGNED_URL_EXPIRY
          );
          return;
        } catch {
          /* fall through to https image_url fallback */
        }
      }
      const singleFb = httpsDisplayImageUrl(bg.image_url);
      if (singleFb) slideBackgroundImageUrls[s.id] = singleFb;
    })
  );

  const captionVariants = (carousel.caption_variants as {
    title?: string;
    medium?: string;
    long?: string;
    short?: string;
    spicy?: string;
  }) ?? {};
  const hashtags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];
  const genOpts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  const useAiBackgroundsCarousel = genOpts.use_ai_backgrounds === true;
  const useAiGenerateCarousel = genOpts.use_ai_generate === true;
  const aiBackgroundsPendingFlag = genOpts.ai_backgrounds_pending === true;
  const generationErrorRecovery = genOpts.generation_error_recovery === true;
  const hasCaptionContent = Boolean(
    captionVariants.title?.trim() ||
      captionVariants.medium?.trim() ||
      captionVariants.long?.trim() ||
      captionVariants.short?.trim() ||
      captionVariants.spicy?.trim()
  );
  const captionHydrating = generationErrorRecovery && !hasCaptionContent;
  const carouselForGen = genOpts.carousel_for as "instagram" | "linkedin" | undefined;

  const usedProjectFaceRefsOnRun = genOpts.ugc_used_project_avatar_refs === true;
  const hasGeneratedUgcBackdrops = slides.some((s) => {
    const bg = s.background as { mode?: string; storage_path?: string } | null;
    const path = bg?.storage_path?.trim() ?? "";
    return (
      bg?.mode === "image" &&
      path.includes(`/generated/${carouselId}/`) &&
      path.startsWith(`user/${user.id}/`)
    );
  });
  /** Instagram/TikTok-style run with AI-generated slide images (promote UI only applies in this band). */
  const saveUgcPromoteBaseline =
    useAiBackgroundsCarousel === true &&
    genOpts.use_ai_generate === true &&
    carouselForGen !== "linkedin";
  /** Can copy this run’s AI frames + series brief into the project library. */
  const saveUgcCharacterCanApply =
    saveUgcPromoteBaseline && !usedProjectFaceRefsOnRun && hasGeneratedUgcBackdrops;
  /** Already conditioned on library face refs—nothing to promote from this carousel. */
  const showSaveUgcAlreadyUsingProjectLine = saveUgcPromoteBaseline && usedProjectFaceRefsOnRun;
  const projectUgcBrief = (project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() ?? "";

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

  const hasShuffleableSlides = slides.some((s) => {
    const bg = s.background as { mode?: string; images?: { image_url?: string; alternates?: string[] }[] } | null;
    if (bg?.mode !== "image" || !Array.isArray(bg.images)) return false;
    return bg.images.some((slot) => {
      const url = slot.image_url?.trim();
      const alts = slot.alternates ?? [];
      const pool = url ? [url, ...alts] : [...alts];
      const valid = pool.filter((u) => typeof u === "string" && u.trim() && /^https?:\/\//i.test(u));
      return valid.length > 1;
    });
  });

  const editorPath = `/p/${projectId}/c/${carouselId}`;
  const isGenerating = carousel.status === "generating"; // always false here (we early-return above)

  return (
    <div className="min-h-[calc(100vh-8rem)] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-6">
        {showGenerationPartial && <GenerationPartialBanner />}
        {!subscription.isPro && (
          hasFullAccess ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{freeGenerationsLeft}</span> free posts left
            </p>
          ) : (
            <UpgradeBanner message="Your 3 free posts are used. This post is still yours to edit and download." />
          )
        )}

        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
              <Link href={`/p/${projectId}`}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back to project</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {slides.length} slides
              </p>
              <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {carousel.title}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ShuffleCarouselBackgroundsButton
              carouselId={carouselId}
              projectId={projectId}
              pathname={editorPath}
              hasShuffleableSlides={hasShuffleableSlides}
              disabled={isGenerating || !hasFullAccess}
            />
            <CarouselMenuDropdown
              carouselId={carouselId}
              projectId={projectId}
              isFavorite={!!carousel.is_favorite}
              disabled={isGenerating}
            />
          </div>
        </header>

        <div className="space-y-3">
          <PostToTikTokPanel
            carouselId={carouselId}
            pathname={editorPath}
            connectedAccount={tiktokConnection?.platform_username ?? (tiktokConnection ? "Connected" : null)}
            slideCount={slides.length}
            initialTitle={carousel.title}
            initialDescription={[captionVariants.long ?? captionVariants.medium ?? "", hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")].filter(Boolean).join("\n\n")}
            schedules={tiktokSchedules.map((schedule) => ({ id: schedule.id, scheduledFor: schedule.scheduled_for, status: schedule.status, lastError: schedule.last_error }))}
          />
          {/* Instagram posting is admin-only until the Meta app review is approved. */}
          {userIsAdmin && (
            <PostToInstagramPanel
              carouselId={carouselId}
              pathname={editorPath}
              connectedAccount={
                selectedInstagram?.username ??
                instagramConnection?.platform_username ??
                (instagramConnection ? "Connected" : null)
              }
              accounts={instagramAccounts}
              selectedIgUserId={selectedInstagram?.igUserId ?? null}
              slideCount={slides.length}
              initialCaption={[captionVariants.long ?? captionVariants.medium ?? "", hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")].filter(Boolean).join("\n\n")}
              configured={Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)}
            />
          )}
        </div>

        <section
          className={cn(
            "rounded-2xl border border-border/60 bg-muted/15 p-3 sm:p-5",
            isGenerating && "pointer-events-none opacity-70"
          )}
          aria-disabled={isGenerating}
          aria-label="Carousel slides"
        >
          <SlideGrid
            slides={slides}
            templates={templates}
            brandKit={brandKit}
            projectId={projectId}
            carouselId={carouselId}
            slideBackgroundImageUrls={slideBackgroundImageUrls}
            exportSize={getExportSize(carousel)}
            exportFormat={getExportFormat(carousel)}
            isPro={hasFullAccess}
            isAdmin={userIsAdmin}
            disabled={isGenerating}
            downloadFilenameSlug={slugifyForFilename([project.name, carousel.title].filter(Boolean).join(" - ")) || undefined}
            enableBackgroundHydrationPoll={useAiBackgroundsCarousel || aiBackgroundsPendingFlag}
            aiImageGenerationPending={false}
          />
        </section>

        <EditorExportSection
          carouselId={carouselId}
          isPro={hasFullAccess}
          disabled={isGenerating}
          exportsUsedThisMonth={exportCount}
          exportsLimit={limits.exportsPerMonth}
          exportFormat={getExportFormat(carousel)}
          exportSize={getExportSize(carousel)}
          exportSettingsPath={`/p/${projectId}/c/${carouselId}`}
          recentExports={recentExports.map((ex) => ({
            id: ex.id,
            status: ex.status,
            storage_path: ex.storage_path,
            created_at: ex.created_at,
          }))}
          captionVariants={captionVariants}
          hashtags={hashtags}
          carouselTitle={carousel.title}
          projectName={project.name}
        />

        {!isGenerating && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 sm:px-4">
            <p className="text-sm text-muted-foreground">Next post</p>
            <Button asChild size="sm" className="shrink-0 gap-1.5">
              <Link href={`/p/${projectId}/new?fromCarousel=${encodeURIComponent(carouselId)}`}>
                <SparklesIcon className="size-3.5" aria-hidden />
                Generate
              </Link>
            </Button>
          </div>
        )}

        <EditorCaptionSection
          carouselId={carouselId}
          captionVariants={captionVariants}
          hashtags={hashtags}
          unsplashAttributions={unsplashAttributions}
          editorPath={editorPath}
          disabled={isGenerating}
          carouselFor={carouselForGen}
          captionHydrating={captionHydrating}
        />
      </div>
    </div>
  );
}
