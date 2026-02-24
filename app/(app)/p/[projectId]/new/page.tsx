import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { getProject, getCarousel, countCarouselsThisMonth, listTemplatesForUser, getDefaultTemplateForNewCarousel } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { PLAN_LIMITS } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Button } from "@/components/ui/button";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import { ArrowLeftIcon } from "lucide-react";

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
  const [project, subscription, limits, carouselCount, regenerateCarousel, templatesRaw, defaultTemplate] = await Promise.all([
    getProject(user.id, projectId),
    getSubscription(user.id, user.email),
    getPlanLimits(user.id, user.email),
    countCarouselsThisMonth(user.id),
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

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-10">
        {!subscription.isPro && (
          <UpgradeBanner message={`Free: ${carouselCount}/${carouselLimit} carousels this month. Upgrade to Pro for ${PLAN_LIMITS.pro.carouselsPerMonth}/month, AI backgrounds, and web search.`} />
        )}
        <header className="flex items-start gap-2">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href={`/p/${projectId}`}>
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{regenerateCarousel ? "Regenerate carousel" : "New carousel"}</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {carouselCount}/{carouselLimit} this month
            </p>
          </div>
        </header>
        <NewCarouselForm
          projectId={projectId}
          isPro={subscription.isPro}
          carouselCount={carouselCount}
          carouselLimit={carouselLimit}
          regenerateCarouselId={regenerateCarousel?.id}
          initialInputType={regenerateCarousel && (regenerateCarousel.input_type === "url" || regenerateCarousel.input_type === "text") ? regenerateCarousel.input_type : regenerateCarousel ? "topic" : undefined}
          initialInputValue={regenerateCarousel?.input_value}
          initialUseAiBackgrounds={regenerateCarousel?.generation_options?.use_ai_backgrounds}
          initialUseUnsplashOnly={regenerateCarousel?.generation_options?.use_unsplash_only}
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
