import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getCarousel, getProject, listSlides, listTemplatesForUser, listExportsByCarousel, countExportsThisMonth, getAsset, countCarouselsLifetime, getPlatformConnections } from "@/lib/server/db";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { resolveBrandKitLogo } from "@/lib/server/brandKit";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
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
import { GenerationPartialBanner } from "@/components/carousels/GenerationPartialBanner";
import { CarouselGeneratingPage } from "@/components/carousels/CarouselGeneratingTrigger";
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
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string; carouselId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const { user } = await getUser();
  const { projectId, carouselId } = await params;
  const resolvedSearchParams = await searchParams;
  const showGenerationPartial = resolvedSearchParams?.generation === "partial";

  const [carousel, project, slides, templatesRaw, recentExports, subscription, exportCount, lifetimeCarouselCount, connections] = await Promise.all([
    getCarousel(user.id, carouselId),
    getProject(user.id, projectId),
    listSlides(user.id, carouselId),
    listTemplatesForUser(user.id, { includeSystem: true }),
    listExportsByCarousel(user.id, carouselId, 3),
    getSubscription(user.id, user.email),
    countExportsThisMonth(user.id),
    countCarouselsLifetime(user.id),
    getPlatformConnections(user.id),
  ]);
  const connectedPlatforms = new Set(connections.map((c) => c.platform));
  const userIsAdmin = isAdmin(user.email ?? null);

  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsLeft = hasFullAccess && !subscription.isPro
    ? FREE_FULL_ACCESS_GENERATIONS - Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS)
    : 0;

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
      const bg = s.background as { mode?: string; storage_path?: string; image_url?: string; asset_id?: string; images?: { image_url?: string; storage_path?: string }[] } | null;
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
      let pathToUse = bg.storage_path;
      if (!pathToUse && bg.asset_id) {
        const asset = await getAsset(user.id, bg.asset_id);
        if (asset?.storage_path) pathToUse = asset.storage_path;
      }
      if (pathToUse) {
        try {
          slideBackgroundImageUrls[s.id] = await getSignedImageUrl(
            "carousel-assets",
            pathToUse,
            600
          );
        } catch {
          // skip
        }
      }
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

  const isGenerating = carousel.status === "generating";

  // When still generating, show only full-page loading—no empty editor, no "No caption yet".
  // CarouselGeneratingPage runs the generate API and refreshes; when done, this page re-renders with results.
  if (isGenerating) {
    return <CarouselGeneratingPage projectId={projectId} carouselId={carouselId} />;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {showGenerationPartial && <GenerationPartialBanner />}
        {!subscription.isPro && (
          hasFullAccess ? (
            <p className="text-sm text-muted-foreground">
              <strong>{freeGenerationsLeft}</strong> of {FREE_FULL_ACCESS_GENERATIONS} free generations left. Upgrade to Pro for more.
            </p>
          ) : (
            <UpgradeBanner message="You've used all 3 free generations. Upgrade to Pro to edit carousels, export, and unlock AI backgrounds." />
          )
        )}

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <Breadcrumbs
              items={[
                { label: project.name, href: isGenerating ? undefined : `/p/${projectId}` },
                { label: carousel.title },
              ]}
              className="mb-0.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {isGenerating ? (
                <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0 size-8" disabled aria-label="Back to project (disabled while generating)">
                  <ArrowLeftIcon className="size-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
                  <Link href={`/p/${projectId}`}>
                    <ArrowLeftIcon className="size-4" />
                    <span className="sr-only">Back to project</span>
                  </Link>
                </Button>
              )}
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
                disabled={isGenerating || !subscription.isPro}
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
          isPro={subscription.isPro}
          disabled={isGenerating}
          exportsUsedThisMonth={exportCount}
          exportFormat={getExportFormat(carousel)}
          exportSize={getExportSize(carousel)}
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
            isPro={subscription.isPro}
            disabled={isGenerating}
          />
        </section>

        {/* Caption */}
        <EditorCaptionSection
          carouselId={carouselId}
          captionVariants={captionVariants}
          hashtags={hashtags}
          unsplashAttributions={unsplashAttributions}
          editorPath={editorPath}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
}
