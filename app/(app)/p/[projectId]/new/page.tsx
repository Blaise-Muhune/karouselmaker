import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getEffectivePlanLimits } from "@/lib/server/subscription";
import {
  getProject,
  getCarousel,
  countCarouselsThisMonth,
  countCarouselsLifetime,
  listTemplatesForUser,
  listFavoriteTemplateIds,
  getDefaultTemplateForNewCarousel,
} from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { CAROUSEL_SLIDES_MAX, CAROUSEL_SLIDES_MIN, FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Button } from "@/components/ui/button";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import { ArrowLeftIcon } from "lucide-react";

export const maxDuration = 800;

export default async function NewCarouselPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    regenerate?: string | string[];
    topic?: string | string[];
    fromCarousel?: string | string[];
  }>;
}>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const sp = await searchParams;
  const regenerateCarouselIdRaw = sp.regenerate;
  const regenerateCarouselId =
    typeof regenerateCarouselIdRaw === "string"
      ? regenerateCarouselIdRaw.trim()
      : Array.isArray(regenerateCarouselIdRaw)
        ? regenerateCarouselIdRaw[0]?.trim() ?? ""
        : "";
  const topicRaw = sp.topic;
  const topicPrefill =
    typeof topicRaw === "string" ? topicRaw.trim() : Array.isArray(topicRaw) ? topicRaw[0]?.trim() ?? "" : "";
  const fromRaw = sp.fromCarousel;
  const fromCarouselId =
    typeof fromRaw === "string" ? fromRaw.trim() : Array.isArray(fromRaw) ? fromRaw[0]?.trim() ?? "" : "";

  const [project, subscription, limits, carouselCount, lifetimeCarouselCount, regenerateCarousel, templatesRaw, defaultTemplate, favoriteIds] =
    await Promise.all([
      getProject(user.id, projectId),
      getSubscription(user.id, user.email),
      getEffectivePlanLimits(user.id, user.email),
      countCarouselsThisMonth(user.id),
      countCarouselsLifetime(user.id),
      regenerateCarouselId ? getCarousel(user.id, regenerateCarouselId) : Promise.resolve(null),
      listTemplatesForUser(user.id, { includeSystem: true }),
      getDefaultTemplateForNewCarousel(user.id),
      listFavoriteTemplateIds(user.id),
    ]);

  if (!project) notFound();
  if (regenerateCarouselId && (!regenerateCarousel || regenerateCarousel.project_id !== projectId)) notFound();

  const favoriteIdSet = new Set(favoriteIds);
  const templateOptions: TemplateOption[] = [];
  for (const t of templatesRaw) {
    const parsed = templateConfigSchema.safeParse(t.config);
    if (parsed.success) {
      templateOptions.push({
        id: t.id,
        name: t.name,
        parsedConfig: parsed.data,
        category: t.category,
        isSystemTemplate: t.user_id == null,
        isFavorite: favoriteIdSet.has(t.id),
      });
    }
  }
  const defaultTemplateId = defaultTemplate?.templateId ?? null;
  const defaultTemplateConfig =
    defaultTemplateId != null
      ? templateOptions.find((o) => o.id === defaultTemplateId)?.parsedConfig ?? null
      : templateOptions[0]?.parsedConfig ?? null;

  let carrySettingsCarousel: Awaited<ReturnType<typeof getCarousel>> = null;
  if (!regenerateCarouselId && fromCarouselId) {
    const c = await getCarousel(user.id, fromCarouselId);
    if (c && c.project_id === projectId) carrySettingsCarousel = c;
  }

  const settingsSourceCarousel = regenerateCarousel ?? carrySettingsCarousel;
  type GenOpts = {
    use_stock_photos?: boolean;
    notes?: string;
    template_id?: string;
    background_asset_ids?: unknown;
    number_of_slides?: unknown;
    use_ai_backgrounds?: boolean;
  };
  const genOpts = (settingsSourceCarousel?.generation_options ?? undefined) as GenOpts | undefined;
  const initialUseStockPhotosFromOpts =
    genOpts == null ? undefined : genOpts.use_stock_photos;
  const templateIdFromOpts = typeof genOpts?.template_id === "string" ? genOpts.template_id.trim() : "";
  const backgroundIdsFromOpts = Array.isArray(genOpts?.background_asset_ids)
    ? (genOpts!.background_asset_ids as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
    : undefined;
  const rawNumSlides = genOpts?.number_of_slides;
  const parsedNumSlides =
    typeof rawNumSlides === "number"
      ? rawNumSlides
      : typeof rawNumSlides === "string"
        ? parseInt(rawNumSlides, 10)
        : NaN;
  const initialNumberOfSlides =
    Number.isFinite(parsedNumSlides) &&
    parsedNumSlides >= CAROUSEL_SLIDES_MIN &&
    parsedNumSlides <= CAROUSEL_SLIDES_MAX
      ? Math.floor(parsedNumSlides)
      : undefined;

  const primaryColor = (project.brand_kit as { primary_color?: string } | null)?.primary_color?.trim() || "#0a0a0a";
  const carouselLimit = limits.carouselsPerMonth;
  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsUsed = Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS);
  const freeGenerationsLeft = FREE_FULL_ACCESS_GENERATIONS - freeGenerationsUsed;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        {!subscription.isPro && !hasFullAccess && (
          <UpgradeBanner message="Your 3 free posts are used. Choose a plan or add a post pack to create the next one." />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft <= 1 && (
          <UpgradeBanner
            message={`${freeGenerationsLeft} free post left. Finish it whenever you are ready, then choose a plan or add a post pack.`}
            variant="inline"
          />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft > 1 && (
          <p className="rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            You have <strong>{FREE_FULL_ACCESS_GENERATIONS} free posts</strong>. {freeGenerationsLeft} left.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon-sm" className="shrink-0" asChild>
              <Link href={`/p/${projectId}`}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {regenerateCarousel ? "Regenerate post" : "New post"}
            </h1>
          </div>
          <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
            {carouselCount}/{carouselLimit}
          </span>
        </div>
        <NewCarouselForm
          key={`${regenerateCarousel?.id ?? "new"}:${topicPrefill}:${fromCarouselId}`}
          projectId={projectId}
          isPro={subscription.isPro}
          hasFullAccess={hasFullAccess}
          carouselCount={carouselCount}
          carouselLimit={carouselLimit}
          regenerateCarouselId={regenerateCarousel?.id}
          initialSettingsCarriedFromCarousel={!!carrySettingsCarousel && !regenerateCarousel}
          initialSelectedTemplateId={templateIdFromOpts || undefined}
          initialBackgroundAssetIds={backgroundIdsFromOpts}
          initialNumberOfSlides={initialNumberOfSlides}
          initialInputValue={regenerateCarousel?.input_value ?? (topicPrefill || undefined)}
          initialUseAiBackgrounds={settingsSourceCarousel?.generation_options?.use_ai_backgrounds}
          initialUseStockPhotos={initialUseStockPhotosFromOpts}
          initialNotes={regenerateCarousel ? genOpts?.notes : carrySettingsCarousel ? "" : undefined}
          templateOptions={templateOptions}
          defaultTemplateId={defaultTemplateId}
          defaultTemplateConfig={defaultTemplateConfig}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
}
