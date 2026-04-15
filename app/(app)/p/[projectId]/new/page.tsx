import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription, getEffectivePlanLimits } from "@/lib/server/subscription";
import { getProject, getCarousel, countCarouselsThisMonth, countCarouselsLifetime, countAiGenerateCarouselsThisMonth, listTemplatesForUser, getDefaultTemplateForNewCarousel, getDefaultLinkedInTemplate } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
import { normalizeContentFocusId } from "@/lib/server/ai/projectContentFocus";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Button } from "@/components/ui/button";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import { ArrowLeftIcon } from "lucide-react";

// Long-running carousel generation (LLM + per-slide AI images). Pro allows up to 800s for AI-generated image requests.
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
  const topicPrefill = typeof topicRaw === "string" ? topicRaw.trim() : Array.isArray(topicRaw) ? topicRaw[0]?.trim() ?? "" : "";
  const fromRaw = sp.fromCarousel;
  const fromCarouselId =
    typeof fromRaw === "string" ? fromRaw.trim() : Array.isArray(fromRaw) ? fromRaw[0]?.trim() ?? "" : "";

  const [project, subscription, limits, carouselCount, lifetimeCarouselCount, aiGenerateUsed, regenerateCarousel, templatesRaw, defaultTemplate, defaultLinkedInTemplate] = await Promise.all([
    getProject(user.id, projectId),
    getSubscription(user.id, user.email),
    getEffectivePlanLimits(user.id, user.email),
    countCarouselsThisMonth(user.id),
    countCarouselsLifetime(user.id),
    countAiGenerateCarouselsThisMonth(user.id),
    regenerateCarouselId ? getCarousel(user.id, regenerateCarouselId) : Promise.resolve(null),
    listTemplatesForUser(user.id, { includeSystem: true }),
    getDefaultTemplateForNewCarousel(user.id),
    getDefaultLinkedInTemplate(user.id),
  ]);

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
      });
    }
  }
  const defaultTemplateId = defaultTemplate?.templateId ?? null;
  const defaultTemplateConfig =
    defaultTemplateId != null
      ? templateOptions.find((o) => o.id === defaultTemplateId)?.parsedConfig ?? null
      : templateOptions[0]?.parsedConfig ?? null;
  const defaultLinkedInTemplateId = defaultLinkedInTemplate?.templateId ?? null;
  const defaultLinkedInTemplateConfig =
    defaultLinkedInTemplateId != null
      ? templateOptions.find((o) => o.id === defaultLinkedInTemplateId)?.parsedConfig ?? null
      : null;

  if (!project) notFound();
  if (regenerateCarouselId && (!regenerateCarousel || regenerateCarousel.project_id !== projectId)) notFound();

  let carrySettingsCarousel: Awaited<ReturnType<typeof getCarousel>> = null;
  if (!regenerateCarouselId && fromCarouselId) {
    const c = await getCarousel(user.id, fromCarouselId);
    if (c && c.project_id === projectId) carrySettingsCarousel = c;
  }

  const settingsSourceCarousel = regenerateCarousel ?? carrySettingsCarousel;
  type GenOpts = {
    use_stock_photos?: boolean;
    use_unsplash_only?: boolean;
    use_pixabay_only?: boolean;
    use_pexels_only?: boolean;
    notes?: string;
    carousel_for?: "instagram" | "linkedin";
    template_id?: string;
    template_ids?: string[];
    background_asset_ids?: unknown;
    number_of_slides?: unknown;
    viral_shorts_style?: boolean;
    use_saved_ugc_character?: boolean;
    product_service_input?: string;
  };
  const genOpts = (settingsSourceCarousel?.generation_options ?? undefined) as GenOpts | undefined;
  const initialUseStockPhotosFromOpts =
    genOpts == null
      ? undefined
      : genOpts.use_stock_photos ??
        !!(genOpts.use_unsplash_only || genOpts.use_pixabay_only || genOpts.use_pexels_only);

  const templateIdFromOpts = typeof genOpts?.template_id === "string" ? genOpts.template_id.trim() : "";
  const templateIdsFromOpts = Array.isArray(genOpts?.template_ids)
    ? (genOpts.template_ids as unknown[])
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .slice(0, 3)
    : undefined;
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
    Number.isFinite(parsedNumSlides) && parsedNumSlides >= 1 && parsedNumSlides <= 12 ? Math.floor(parsedNumSlides) : undefined;

  const projectContentFocus = normalizeContentFocusId(project.content_focus);
  const projectUseSavedUgc = (project as { use_saved_ugc_character?: boolean | null }).use_saved_ugc_character;
  const projectUgcBrief = (project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() ?? "";
  const projectUgcAvatarAssetIds = Array.isArray((project as { ugc_character_avatar_asset_ids?: unknown }).ugc_character_avatar_asset_ids)
    ? ((project as { ugc_character_avatar_asset_ids?: unknown[] }).ugc_character_avatar_asset_ids as unknown[])
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const projectLegacyUgcAvatarId = (project as { ugc_character_avatar_asset_id?: string | null }).ugc_character_avatar_asset_id?.trim() ?? "";
  const hasProjectSavedUgcCharacter =
    projectUgcBrief.length > 0 || projectUgcAvatarAssetIds.length > 0 || projectLegacyUgcAvatarId.length > 0;
  const userIsAdmin = isAdmin(user.email ?? null);
  const initialUseSavedUgcCharacter = settingsSourceCarousel
    ? genOpts?.use_saved_ugc_character !== false && hasProjectSavedUgcCharacter
    : projectUseSavedUgc !== false && hasProjectSavedUgcCharacter;

  const primaryColor = (project.brand_kit as { primary_color?: string } | null)?.primary_color?.trim() || "#0a0a0a";

  const carouselLimit = limits.carouselsPerMonth;
  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsUsed = Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS);
  const freeGenerationsLeft = FREE_FULL_ACCESS_GENERATIONS - freeGenerationsUsed;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        {!subscription.isPro && !hasFullAccess && (
          <UpgradeBanner message="You've used all 3 free full-access generations. Stock photos and images from your library still work on this page. AI-generated backgrounds are off without a plan—upgrade for AI images, web search, and higher limits." />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft <= 1 && (
          <UpgradeBanner
            message={`${freeGenerationsLeft} free full-access generation left (web images + full editor). After that, stock and library images still work; AI images turn off without a plan.`}
            variant="inline"
          />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft > 1 && (
          <p className="rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            You have <strong>{FREE_FULL_ACCESS_GENERATIONS} free full-access generations</strong> (web images + full editor). {freeGenerationsLeft} left. Stock and library images always work; AI images need Pro after free runs are used.
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
            <h1 className="text-xl font-semibold tracking-tight truncate">{regenerateCarousel ? "Regenerate carousel" : "New carousel"}</h1>
          </div>
          <span
            className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shrink-0"
            title="Carousels this month"
          >
            {carouselCount}/{carouselLimit}
          </span>
        </div>
        <NewCarouselForm
          key={`${regenerateCarousel?.id ?? "new"}:${topicPrefill}:${fromCarouselId}`}
          projectId={projectId}
          isPro={subscription.isPro}
          isAdmin={userIsAdmin}
          hasFullAccess={hasFullAccess}
          freeGenerationsUsed={freeGenerationsUsed}
          freeGenerationsTotal={FREE_FULL_ACCESS_GENERATIONS}
          carouselCount={carouselCount}
          carouselLimit={carouselLimit}
          aiGenerateUsed={aiGenerateUsed}
          aiGenerateLimit={limits.aiGenerateCarouselsPerMonth}
          regenerateCarouselId={regenerateCarousel?.id}
          initialSettingsCarriedFromCarousel={!!carrySettingsCarousel && !regenerateCarousel}
          initialSelectedTemplateId={templateIdFromOpts || undefined}
          initialSelectedTemplateIds={templateIdsFromOpts}
          initialBackgroundAssetIds={backgroundIdsFromOpts}
          initialViralShortsStyle={userIsAdmin && genOpts?.viral_shorts_style === true}
          initialNumberOfSlides={initialNumberOfSlides}
          initialInputType={
            regenerateCarousel && (regenerateCarousel.input_type === "url" || regenerateCarousel.input_type === "text")
              ? regenerateCarousel.input_type
              : regenerateCarousel
                ? "topic"
                : carrySettingsCarousel
                  ? "topic"
                  : undefined
          }
          initialInputValue={regenerateCarousel?.input_value ?? (topicPrefill || undefined)}
          initialUseAiBackgrounds={settingsSourceCarousel?.generation_options?.use_ai_backgrounds}
          initialUseStockPhotos={initialUseStockPhotosFromOpts}
          initialUseAiGenerate={settingsSourceCarousel?.generation_options?.use_ai_generate}
          initialUseWebSearch={settingsSourceCarousel?.generation_options?.use_web_search}
          initialCarouselFor={genOpts?.carousel_for}
          initialNotes={
            regenerateCarousel ? genOpts?.notes : carrySettingsCarousel ? "" : undefined
          }
          initialAiStyleReferenceAssetIds={
            (settingsSourceCarousel?.generation_options as { ai_style_reference_asset_ids?: string[] } | undefined)
              ?.ai_style_reference_asset_ids
          }
          initialUgcCharacterReferenceAssetIds={
            (settingsSourceCarousel?.generation_options as { ugc_character_reference_asset_ids?: string[] } | undefined)
              ?.ugc_character_reference_asset_ids
          }
          initialProductReferenceAssetIds={
            (settingsSourceCarousel?.generation_options as { product_reference_asset_ids?: string[] } | undefined)
              ?.product_reference_asset_ids
          }
          initialProductServiceInput={
            (settingsSourceCarousel?.generation_options as { product_service_input?: string } | undefined)
              ?.product_service_input
          }
          templateOptions={templateOptions}
          defaultTemplateId={defaultTemplateId}
          defaultTemplateConfig={defaultTemplateConfig}
          defaultLinkedInTemplateId={defaultLinkedInTemplateId}
          defaultLinkedInTemplateConfig={defaultLinkedInTemplateConfig}
          primaryColor={primaryColor}
          importTemplateWatermarkText={
            (project.brand_kit as { watermark_text?: string | null } | null)?.watermark_text?.trim() || undefined
          }
          projectContentFocus={projectContentFocus}
          initialUseSavedUgcCharacter={initialUseSavedUgcCharacter}
          hasProjectSavedUgcCharacter={hasProjectSavedUgcCharacter}
        />
      </div>
    </div>
  );
}
