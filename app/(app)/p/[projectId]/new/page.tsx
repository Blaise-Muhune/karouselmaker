import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { getProject, getCarousel, countCarouselsThisMonth, countCarouselsLifetime, countAiGenerateCarouselsThisMonth, listTemplatesForUser, getDefaultTemplateForNewCarousel } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { PLAN_LIMITS, FREE_FULL_ACCESS_GENERATIONS, AI_GENERATE_LIMIT_PRO } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
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
  searchParams: Promise<{ regenerate?: string }>;
}>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const { regenerate: regenerateCarouselId } = await searchParams;
  const [project, subscription, limits, carouselCount, lifetimeCarouselCount, aiGenerateUsed, regenerateCarousel, templatesRaw, defaultTemplate] = await Promise.all([
    getProject(user.id, projectId),
    getSubscription(user.id, user.email),
    getPlanLimits(user.id, user.email),
    countCarouselsThisMonth(user.id),
    countCarouselsLifetime(user.id),
    countAiGenerateCarouselsThisMonth(user.id),
    regenerateCarouselId ? getCarousel(user.id, regenerateCarouselId) : Promise.resolve(null),
    listTemplatesForUser(user.id, { includeSystem: true }),
    getDefaultTemplateForNewCarousel(user.id),
  ]);

  const templateOptions: TemplateOption[] = [];
  for (const t of templatesRaw) {
    const parsed = templateConfigSchema.safeParse(t.config);
    if (parsed.success) {
      templateOptions.push({ id: t.id, name: t.name, parsedConfig: parsed.data });
    }
  }
  const defaultTemplateId = defaultTemplate?.templateId ?? null;
  const defaultTemplateConfig =
    defaultTemplateId != null
      ? templateOptions.find((o) => o.id === defaultTemplateId)?.parsedConfig ?? null
      : templateOptions[0]?.parsedConfig ?? null;

  if (!project) notFound();
  if (regenerateCarouselId && (!regenerateCarousel || regenerateCarousel.project_id !== projectId)) notFound();

  const primaryColor = (project.brand_kit as { primary_color?: string } | null)?.primary_color?.trim() || "#0a0a0a";

  const carouselLimit = limits.carouselsPerMonth;
  const hasFullAccess = subscription.isPro || lifetimeCarouselCount < FREE_FULL_ACCESS_GENERATIONS;
  const freeGenerationsUsed = Math.min(lifetimeCarouselCount, FREE_FULL_ACCESS_GENERATIONS);
  const freeGenerationsLeft = FREE_FULL_ACCESS_GENERATIONS - freeGenerationsUsed;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        {!subscription.isPro && !hasFullAccess && (
          <UpgradeBanner message="You've used your 3 free generations with full access. Upgrade to Pro for AI backgrounds, web search, and more carousels." />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft <= 1 && (
          <UpgradeBanner message={`${freeGenerationsLeft} free generation left with full access. Upgrade to Pro to keep AI backgrounds and web search.`} variant="inline" />
        )}
        {!subscription.isPro && hasFullAccess && freeGenerationsLeft > 1 && (
          <p className="rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            You have <strong>{FREE_FULL_ACCESS_GENERATIONS} free generations</strong> with full access (AI backgrounds, web search). {freeGenerationsLeft} left.
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
          projectId={projectId}
          isPro={subscription.isPro}
          isAdmin={isAdmin(user.email ?? null)}
          hasFullAccess={hasFullAccess}
          freeGenerationsUsed={freeGenerationsUsed}
          freeGenerationsTotal={FREE_FULL_ACCESS_GENERATIONS}
          carouselCount={carouselCount}
          carouselLimit={carouselLimit}
          aiGenerateUsed={aiGenerateUsed}
          aiGenerateLimit={AI_GENERATE_LIMIT_PRO}
          regenerateCarouselId={regenerateCarousel?.id}
          initialInputType={regenerateCarousel && (regenerateCarousel.input_type === "url" || regenerateCarousel.input_type === "text") ? regenerateCarousel.input_type : regenerateCarousel ? "topic" : undefined}
          initialInputValue={regenerateCarousel?.input_value}
          initialUseAiBackgrounds={regenerateCarousel?.generation_options?.use_ai_backgrounds}
          initialUseUnsplashOnly={regenerateCarousel?.generation_options?.use_unsplash_only}
          initialUseAiGenerate={regenerateCarousel?.generation_options?.use_ai_generate}
          initialUseWebSearch={regenerateCarousel?.generation_options?.use_web_search}
          templateOptions={templateOptions}
          defaultTemplateId={defaultTemplateId}
          defaultTemplateConfig={defaultTemplateConfig}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
}
