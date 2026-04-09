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
  searchParams: Promise<{ regenerate?: string; topic?: string }>;
}>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const { regenerate: regenerateCarouselId, topic: topicPrefill } = await searchParams;
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

  const projectContentFocus = normalizeContentFocusId(project.content_focus);
  const projectUseSavedUgc = (project as { use_saved_ugc_character?: boolean | null }).use_saved_ugc_character;
  const initialUseSavedUgcCharacter = regenerateCarousel
    ? (regenerateCarousel.generation_options as { use_saved_ugc_character?: boolean } | undefined)
        ?.use_saved_ugc_character !== false
    : projectUseSavedUgc !== false;

  const primaryColor = (project.brand_kit as { primary_color?: string } | null)?.primary_color?.trim() || "#0a0a0a";

  const carouselLimit = limits.carouselsPerMonth;
  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsUsed = Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS);
  const freeGenerationsLeft = FREE_FULL_ACCESS_GENERATIONS - freeGenerationsUsed;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        {!subscription.isPro && !hasFullAccess && (
          <UpgradeBanner message="You've used your 3 free generations with Web images and full editor access. Stock photos and your own images still work — choose a paid plan for Web images, AI generate, web search, and higher limits." />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft <= 1 && (
          <UpgradeBanner
            message={`${freeGenerationsLeft} free generation left with Web images and full editor. Subscribe to keep those perks. Stock photos stay available on every plan.`}
            variant="inline"
          />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft > 1 && (
          <p className="rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            You have <strong>{FREE_FULL_ACCESS_GENERATIONS} free generations</strong> with Web images and full editor access. {freeGenerationsLeft} left. Stock photos work on every plan.
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
          key={`${regenerateCarousel?.id ?? "new"}:${topicPrefill?.trim() ?? ""}`}
          projectId={projectId}
          isPro={subscription.isPro}
          isAdmin={isAdmin(user.email ?? null)}
          hasFullAccess={hasFullAccess}
          freeGenerationsUsed={freeGenerationsUsed}
          freeGenerationsTotal={FREE_FULL_ACCESS_GENERATIONS}
          carouselCount={carouselCount}
          carouselLimit={carouselLimit}
          aiGenerateUsed={aiGenerateUsed}
          aiGenerateLimit={limits.aiGenerateCarouselsPerMonth}
          regenerateCarouselId={regenerateCarousel?.id}
          initialInputType={regenerateCarousel && (regenerateCarousel.input_type === "url" || regenerateCarousel.input_type === "text") ? regenerateCarousel.input_type : regenerateCarousel ? "topic" : undefined}
          initialInputValue={regenerateCarousel?.input_value ?? topicPrefill?.trim() ?? undefined}
          initialUseAiBackgrounds={regenerateCarousel?.generation_options?.use_ai_backgrounds}
          initialUseStockPhotos={(() => {
            const opts = regenerateCarousel?.generation_options as { use_stock_photos?: boolean; use_unsplash_only?: boolean; use_pixabay_only?: boolean; use_pexels_only?: boolean } | undefined;
            return opts?.use_stock_photos ?? !!(opts?.use_unsplash_only || opts?.use_pixabay_only || opts?.use_pexels_only);
          })()}
          initialUseAiGenerate={regenerateCarousel?.generation_options?.use_ai_generate}
          initialUseWebSearch={regenerateCarousel?.generation_options?.use_web_search}
          initialCarouselFor={(regenerateCarousel?.generation_options as { carousel_for?: "instagram" | "linkedin" } | undefined)?.carousel_for}
          initialNotes={(regenerateCarousel?.generation_options as { notes?: string } | undefined)?.notes}
          initialAiStyleReferenceAssetIds={
            (regenerateCarousel?.generation_options as { ai_style_reference_asset_ids?: string[] } | undefined)
              ?.ai_style_reference_asset_ids
          }
          initialUgcCharacterReferenceAssetIds={
            (regenerateCarousel?.generation_options as { ugc_character_reference_asset_ids?: string[] } | undefined)
              ?.ugc_character_reference_asset_ids
          }
          templateOptions={templateOptions}
          defaultTemplateId={defaultTemplateId}
          defaultTemplateConfig={defaultTemplateConfig}
          defaultLinkedInTemplateId={defaultLinkedInTemplateId}
          defaultLinkedInTemplateConfig={defaultLinkedInTemplateConfig}
          primaryColor={primaryColor}
          projectContentFocus={projectContentFocus}
          initialUseSavedUgcCharacter={initialUseSavedUgcCharacter}
        />
      </div>
    </div>
  );
}
