import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";

/** Ensure router.refresh() always gets fresh data so generating→done transition is visible. */
export const dynamic = "force-dynamic";
import { getSubscription, getEffectivePlanLimits } from "@/lib/server/subscription";
import { getCarousel, getProject, listSlides, listTemplatesForUser, listExportsByCarousel, countExportsThisMonth, getAsset, countCarouselsLifetime, getPlatformConnections } from "@/lib/server/db";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { httpsDisplayImageUrl } from "@/lib/server/storage/signedUrlUtils";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SlideGrid, type TemplateWithConfig } from "@/components/carousels/SlideGrid";
import { CarouselMenuDropdown } from "@/components/carousels/CarouselMenuDropdown";
import { ShuffleCarouselBackgroundsButton } from "@/components/carousels/ShuffleCarouselBackgroundsButton";
import { EditorCaptionSection } from "@/components/editor/EditorCaptionSection";
import { EditorExportSection } from "@/components/editor/EditorExportSection";
import { PostToFacebookButton } from "@/components/platforms/PostToFacebookButton";
import { PostToInstagramButton } from "@/components/platforms/PostToInstagramButton";
import { ConnectInPopupLink } from "@/components/platforms/ConnectInPopupLink";
import { PlatformIcon } from "@/components/platforms/PlatformIcon";
import { ConnectedAccountsModalTrigger } from "@/components/settings/ConnectedAccountsModalTrigger";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { ExportFormat, ExportSize, PlatformName } from "@/lib/server/db/types";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { slugifyForFilename } from "@/lib/utils";
import { GenerationPartialBanner } from "@/components/carousels/GenerationPartialBanner";
import { CarouselGeneratingPage } from "@/components/carousels/CarouselGeneratingTrigger";
import { SimilarCarouselIdeas } from "@/components/carousels/SimilarCarouselIdeas";
import { SaveUgcCharacterFromCarouselButton } from "@/components/carousels/SaveUgcCharacterFromCarouselButton";
import { normalizeContentFocusId } from "@/lib/server/ai/projectContentFocus";
import { ArrowLeftIcon } from "lucide-react";

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
  const { projectId, carouselId } = await params;
  const resolvedSearchParams = await searchParams;
  const showGenerationPartial = resolvedSearchParams?.generation === "partial";

  const [carousel, project, slides, templatesRaw, recentExports, subscription, exportCount, lifetimeCarouselCount, connections, limits] =
    await Promise.all([
      getCarousel(user.id, carouselId),
      getProject(user.id, projectId),
      listSlides(user.id, carouselId),
      listTemplatesForUser(user.id, { includeSystem: true }),
      listExportsByCarousel(user.id, carouselId, 3),
      getSubscription(user.id, user.email),
      countExportsThisMonth(user.id),
      countCarouselsLifetime(user.id),
      getPlatformConnections(user.id),
      getEffectivePlanLimits(user.id, user.email),
    ]);
  const connectedPlatforms = new Set(connections.map((c) => c.platform));
  const userIsAdmin = isAdmin(user.email ?? null);

  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsLeft = hasFullAccess && !subscription.isPro
    ? FREE_FULL_ACCESS_GENERATIONS - Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS)
    : 0;

  if (!carousel) notFound();
  if (!project) notFound();

  // Show loading immediately when generating; skip heavy work so refresh gets fresh status.
  if (carousel.status === "generating") {
    return <CarouselGeneratingPage projectId={projectId} carouselId={carouselId} />;
  }

  const templates: TemplateWithConfig[] = templatesRaw
    .map((t) => {
      const parsed = templateConfigSchema.safeParse(t.config);
      if (!parsed.success) return null;
      return { ...t, parsedConfig: parsed.data };
    })
    .filter((t): t is TemplateWithConfig => t != null);

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
  const aiBackgroundsPendingFlag = genOpts.ai_backgrounds_pending === true;
  const generationErrorRecovery = genOpts.generation_error_recovery === true;
  const similarCarouselIdeasFromOpts = Array.isArray(genOpts.similar_carousel_ideas)
    ? (genOpts.similar_carousel_ideas as string[])
    : [];
  const hasCaptionContent = Boolean(
    captionVariants.title?.trim() ||
      captionVariants.medium?.trim() ||
      captionVariants.long?.trim() ||
      captionVariants.short?.trim() ||
      captionVariants.spicy?.trim()
  );
  const captionHydrating = generationErrorRecovery && !hasCaptionContent;
  const carouselForGen = genOpts.carousel_for as "instagram" | "linkedin" | undefined;
  const similarIdeasLoading =
    generationErrorRecovery && similarCarouselIdeasFromOpts.length === 0 && carouselForGen !== "linkedin";

  const contentFocusId = normalizeContentFocusId(project.content_focus);
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
  /** UGC + AI images, run did not use project library face refs, and we can copy AI frames + a brief. */
  const saveUgcCharacterCanApply =
    contentFocusId === "ugc" &&
    useAiBackgroundsCarousel === true &&
    genOpts.use_ai_generate === true &&
    !usedProjectFaceRefsOnRun &&
    hasGeneratedUgcBackdrops;
  const saveUgcCharacterDisabledHint = !saveUgcCharacterCanApply
    ? contentFocusId !== "ugc"
      ? "Set the project’s content style to Creator (UGC) under Project → Edit."
      : !useAiBackgroundsCarousel
        ? "This carousel didn’t use AI backgrounds (or they’re off). Generate with AI images on to capture a character lock."
        : genOpts.use_ai_generate !== true
          ? "Needs AI-generated backgrounds—stock or web images don’t store a character lock for this carousel."
          : usedProjectFaceRefsOnRun
            ? "This run used your project’s saved face photos already—nothing new to promote from the carousel."
            : !hasGeneratedUgcBackdrops
              ? "No AI-generated slide images on this carousel yet—wait for generation to finish or regenerate with AI images."
              : ""
    : "";
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
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {showGenerationPartial && <GenerationPartialBanner />}
        <SaveUgcCharacterFromCarouselButton
          projectId={projectId}
          carouselId={carouselId}
          hasExistingSavedBrief={projectUgcBrief.length > 0}
          canSave={saveUgcCharacterCanApply}
          disabledHint={saveUgcCharacterDisabledHint}
        />
        {!subscription.isPro && (
          hasFullAccess ? (
            <p className="text-sm text-muted-foreground">
              <strong>{freeGenerationsLeft}</strong> of {FREE_FULL_ACCESS_GENERATIONS} free generations left. Subscribe for full limits.
            </p>
          ) : (
            <UpgradeBanner message="You've used all 3 free generations. Choose a plan to edit carousels, export, and unlock AI backgrounds." />
          )
        )}

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <Breadcrumbs
              items={[
                { label: project.name, href: `/p/${projectId}` },
                { label: carousel.title },
              ]}
              className="mb-0.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
                <Link href={`/p/${projectId}`}>
                  <ArrowLeftIcon className="size-4" />
                  <span className="sr-only">Back to project</span>
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight truncate">{carousel.title}</h1>
                <p className="text-muted-foreground text-sm">
                  {getExportSize(carousel).replace("x", "×")}
                  <span className="mx-1.5 opacity-50">·</span>
                  {carousel.status}
                </p>
              </div>
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
          </div>
        </header>

        {/* Export */}
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
          isAdmin={userIsAdmin}
          postToPlatforms={userIsAdmin ? (project.post_to_platforms as Record<string, boolean> | undefined) : undefined}
          connectedPlatforms={userIsAdmin ? Array.from(connectedPlatforms) : undefined}
          captionVariants={captionVariants}
          hashtags={hashtags}
          carouselTitle={carousel.title}
          projectName={project.name}
        />

        {/* Post to (admin only) */}
        {userIsAdmin && !isGenerating && (() => {
          const pt = (project.post_to_platforms ?? {}) as Record<string, boolean>;
          const enabled = (["facebook", "instagram"] as const).filter((k) => pt[k]);
          if (enabled.length === 0) return null;
          const labels: Record<string, string> = {
            facebook: "Facebook",
            instagram: "Instagram",
          };
          return (
            <section>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Post to
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {enabled.map((key) => {
                  const connected = connectedPlatforms.has(key);
                  if (key === "facebook" && connected) {
                    return <PostToFacebookButton key={key} carouselId={carouselId} />;
                  }
                  if (key === "instagram" && connected) {
                    return <PostToInstagramButton key={key} carouselId={carouselId} />;
                  }
                  const label = connected ? labels[key] : `${labels[key]} (Connect)`;
                  const pillClass = "inline-flex items-center justify-center rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-foreground hover:bg-muted hover:border-primary/50 transition-colors";
                  return (
                    <ConnectInPopupLink
                      key={key}
                      href={connected ? "#" : `/api/oauth/${key}/connect`}
                      className={pillClass}
                      title={label}
                      aria-label={label}
                    >
                      <PlatformIcon platform={key} />
                    </ConnectInPopupLink>
                  );
                })}
                <ConnectedAccountsModalTrigger />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Post to Facebook and Post to Instagram publish your latest export (carousel images). Export above first, then use View on Facebook / View on Instagram after posting.
              </p>
            </section>
          );
        })()}

        {/* Frames */}
        <section className={isGenerating ? "pointer-events-none opacity-70" : ""} aria-disabled={isGenerating}>
          <p className="text-muted-foreground mb-2 text-xs">
            {isGenerating ? "Generating…" : "Click to edit, drag to reorder"}
          </p>
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
            disabled={isGenerating}
            downloadFilenameSlug={slugifyForFilename([project.name, carousel.title].filter(Boolean).join(" - ")) || undefined}
            enableBackgroundHydrationPoll={useAiBackgroundsCarousel || aiBackgroundsPendingFlag}
          />
        </section>

        <SimilarCarouselIdeas
          projectId={projectId}
          ideas={similarCarouselIdeasFromOpts}
          loading={similarIdeasLoading}
        />

        {/* Caption */}
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
