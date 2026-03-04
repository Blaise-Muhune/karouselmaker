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
import { ConnectInPopupLink } from "@/components/platforms/ConnectInPopupLink";
import { ConnectedAccountsModalTrigger } from "@/components/settings/ConnectedAccountsModalTrigger";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { GoProBar } from "@/components/subscription/GoProBar";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { ExportFormat, ExportSize } from "@/lib/server/db/types";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
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

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-10">
        {!subscription.isPro && <GoProBar />}
        {hasFullAccess && !subscription.isPro && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
            You have full access for your <strong>{FREE_FULL_ACCESS_GENERATIONS} free carousel generations</strong>. {freeGenerationsLeft} {freeGenerationsLeft === 1 ? "generation" : "generations"} left—then upgrade to Pro to keep editing and exporting.
          </div>
        )}
        {!hasFullAccess && (
          <UpgradeBanner message="You've used your 3 free generations with full access. Upgrade to Pro to edit slides, export, and unlock AI backgrounds." />
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
                disabled={!subscription.isPro}
              />
              <CarouselMenuDropdown
                carouselId={carouselId}
                projectId={projectId}
                isFavorite={!!carousel.is_favorite}
              />
            </div>
          </div>
        </header>

        {/* Export */}
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
          postToPlatforms={userIsAdmin ? (project.post_to_platforms as Record<string, boolean> | undefined) : undefined}
          connectedPlatforms={userIsAdmin ? Array.from(connectedPlatforms) : undefined}
        />

        {/* Post to (admin only) */}
        {userIsAdmin && (() => {
          const pt = (project.post_to_platforms ?? {}) as Record<string, boolean>;
          const enabled = (["facebook", "tiktok", "instagram", "linkedin", "youtube"] as const).filter((k) => pt[k]);
          if (enabled.length === 0) return null;
          const labels: Record<string, string> = {
            facebook: "Facebook",
            tiktok: "TikTok",
            instagram: "Instagram",
            linkedin: "LinkedIn",
            youtube: "YouTube (video only)",
          };
          // Share or upload URLs (open in new tab). For FB/LinkedIn we pass this carousel page URL; others open upload/feed.
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
          const pageUrl = baseUrl ? `${baseUrl}${editorPath}` : "";
          const shareUrl = (key: string) => {
            switch (key) {
              case "facebook":
                return pageUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}` : "https://www.facebook.com/";
              case "linkedin":
                return pageUrl ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}` : "https://www.linkedin.com/feed/";
              case "tiktok":
                return "https://www.tiktok.com/upload";
              case "instagram":
                return "https://www.instagram.com/";
              case "youtube":
                return "https://studio.youtube.com/";
              default:
                return "#";
            }
          };
          return (
            <section>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Post to
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {enabled.map((key) => {
                  const connected = connectedPlatforms.has(key);
                  const isFacebook = key === "facebook";
                  const isTiktok = key === "tiktok";
                  if (isFacebook && connected) {
                    return <PostToFacebookButton key={key} carouselId={carouselId} />;
                  }
                  if (isTiktok && connected) {
                    return (
                      <span
                        key={key}
                        className="inline-flex flex-col rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground"
                        title="Generate a video in Video preview above, then click Post to TikTok there."
                      >
                        {labels[key]} — use Video preview to post
                      </span>
                    );
                  }
                  const href = connected ? shareUrl(key) : `/api/oauth/${key}/connect`;
                  const label = connected ? labels[key] : `${labels[key]} (Connect)`;
                  const pillClass = "inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/50 transition-colors";
                  if (!connected) {
                    return (
                      <ConnectInPopupLink key={key} href={href} className={pillClass}>
                        {label}
                      </ConnectInPopupLink>
                    );
                  }
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={pillClass}
                    >
                      {label}
                    </a>
                  );
                })}
                <ConnectedAccountsModalTrigger />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                {connectedPlatforms.has("facebook")
                  ? "Post to Facebook publishes all carousel images from your latest export as one post. Export the carousel above first. After posting, use View on Facebook to open the post."
                  : connectedPlatforms.has("tiktok")
                    ? "TikTok: generate a video in Video preview above, then click Post to TikTok in the modal to upload to your TikTok inbox."
                    : connectedPlatforms.size > 0
                      ? "Connected accounts open share or upload in a new tab. Download your export above first."
                      : "Connect opens in a popup so you don’t lose your video or export. Or open Connected accounts to manage all."}
              </p>
            </section>
          );
        })()}

        {/* Slides */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Slides · Click to edit, drag to reorder
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
          />
        </section>

        {/* Caption */}
        <EditorCaptionSection
          carouselId={carouselId}
          captionVariants={captionVariants}
          hashtags={hashtags}
          unsplashAttributions={unsplashAttributions}
          editorPath={editorPath}
        />
      </div>
    </div>
  );
}
