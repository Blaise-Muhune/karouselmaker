import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { listTemplatesForUser, countUserTemplates } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { PLAN_LIMITS } from "@/lib/constants";
import Link from "next/link";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import { DuplicateTemplateButton } from "@/components/templates/DuplicateTemplateButton";
import { ImportTemplateButton } from "@/components/templates/ImportTemplateButton";
import { TemplatePreviewThumb } from "@/components/carousels/TemplatePreviewThumb";
import { TemplatesDesignFilter } from "@/components/templates/TemplatesDesignFilter";
import { Button } from "@/components/ui/button";
import { LockIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Suspense } from "react";

/** Unsplash placeholder images for templates that support a background image. Picked by index for variety. */
const TEMPLATE_PREVIEW_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&q=80",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1080&q=80",
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1080&q=80",
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1080&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&q=80",
];

function parseTemplateConfig(config: unknown): TemplateConfig | null {
  const result = templateConfigSchema.safeParse(config);
  return result.success ? result.data : null;
}

function isNoImageTemplate(
  t: { config: unknown },
  parse: (config: unknown) => TemplateConfig | null
): boolean {
  return parse(t.config)?.backgroundRules?.allowImage === false;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const { user } = await getUser();
  const userIsAdmin = isAdmin(user.email ?? null);
  const params = await searchParams;
  const design = params.design === "noImage" ? "noImage" : "withImage";

  const [templates, subscription, userTemplateCount] = await Promise.all([
    listTemplatesForUser(user.id, { includeSystem: true }),
    getSubscription(user.id, user.email),
    countUserTemplates(user.id),
  ]);

  const systemTemplatesAll = templates.filter((t) => t.user_id == null);
  const userTemplatesAll = templates.filter((t) => t.user_id === user.id);

  const userTemplates =
    design === "noImage"
      ? userTemplatesAll.filter((t) => isNoImageTemplate(t, parseTemplateConfig))
      : userTemplatesAll.filter((t) => !isNoImageTemplate(t, parseTemplateConfig));
  const systemTemplates =
    design === "noImage"
      ? systemTemplatesAll.filter((t) => isNoImageTemplate(t, parseTemplateConfig))
      : systemTemplatesAll.filter((t) => !isNoImageTemplate(t, parseTemplateConfig));

  const templateLimit = subscription.isPro ? PLAN_LIMITS.pro.customTemplates : PLAN_LIMITS.free.customTemplates;
  const atTemplateLimit = userTemplateCount >= templateLimit;

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        {!subscription.isPro && (
          <UpgradeBanner
            message="Free: View templates only. Upgrade to Pro to pick templates when editing carousels."
            variant="banner"
          />
        )}

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {subscription.isPro
              ? `${userTemplateCount}/${templateLimit} custom · Duplicate system templates to customize`
              : `System templates only · Pro for custom layouts`}
          </p>
          {subscription.isPro && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant={atTemplateLimit ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
                disabled={atTemplateLimit}
                asChild={!atTemplateLimit}
              >
                {atTemplateLimit ? (
                  <>Limit reached</>
                ) : (
                  <Link href="/templates/new">
                    <PlusIcon className="size-4" />
                    Craft template
                  </Link>
                )}
              </Button>
              <ImportTemplateButton
                isPro={subscription.isPro}
                atLimit={atTemplateLimit}
                isAdmin={userIsAdmin}
                variant="outline"
                size="sm"
                className="gap-1.5"
              />
              <Suspense fallback={<div className="h-8 w-[180px] rounded-md border border-border bg-muted/30" />}>
                <TemplatesDesignFilter />
              </Suspense>
            </div>
          )}
        </header>

        {/* Your templates */}
        <section className="mb-10">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Your templates
          </p>
          {userTemplates.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userTemplates.map((t, idx) => {
                const parsed = parseTemplateConfig(t.config);
                const previewImageUrl =
                  parsed?.backgroundRules?.allowImage !== false
                    ? TEMPLATE_PREVIEW_IMAGE_URLS[idx % TEMPLATE_PREVIEW_IMAGE_URLS.length]
                    : undefined;
                return (
                <li key={t.id}>
                  <div className="group rounded-xl border border-border/60 bg-card overflow-hidden transition-colors hover:bg-accent/20 hover:border-border">
                    <Link href={`/templates/${t.id}/edit`} className="block">
                      <TemplatePreviewThumb
                        config={parsed}
                        category={t.category}
                        previewImageUrl={previewImageUrl}
                        className="w-full rounded-t-xl rounded-b-none border-0 border-b border-border/60"
                      />
                    </Link>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <Link href={`/templates/${t.id}/edit`} className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate" title={t.name}>
                          {t.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t.category} · {t.aspect_ratio}
                        </p>
                      </Link>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <DuplicateTemplateButton
                          templateId={t.id}
                          templateName={t.name}
                          category={t.category}
                          isPro={subscription.isPro}
                          atLimit={atTemplateLimit}
                        />
                        <Button variant="ghost" size="icon-xs" asChild>
                          <Link href={`/templates/${t.id}/edit`} aria-label={`Edit ${t.name}`}>
                            <PencilIcon className="size-3.5" />
                          </Link>
                        </Button>
                        <DeleteTemplateButton
                          templateId={t.id}
                          templateName={t.name}
                          isPro={subscription.isPro}
                          isAdmin={userIsAdmin}
                          isSystemTemplate={false}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-muted-foreground text-sm">
                {subscription.isPro
                  ? "No custom templates yet"
                  : "Custom templates are Pro-only"}
              </p>
              <p className="text-muted-foreground/80 mt-1 text-xs">
                {subscription.isPro
                  ? "Duplicate a system template below to get started."
                  : "Upgrade to create your own layouts."}
              </p>
            </div>
          )}
        </section>

        {/* System templates */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            System templates
          </p>
          {systemTemplates.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemTemplates.map((t, idx) => {
                const parsed = parseTemplateConfig(t.config);
                const previewImageUrl =
                  parsed?.backgroundRules?.allowImage !== false
                    ? TEMPLATE_PREVIEW_IMAGE_URLS[idx % TEMPLATE_PREVIEW_IMAGE_URLS.length]
                    : undefined;
                return (
                <li key={t.id}>
                  <div className="group rounded-xl border border-border/60 bg-card overflow-hidden transition-colors hover:bg-accent/20 hover:border-border">
                    <div className="relative">
                      {userIsAdmin ? (
                        <Link href={`/templates/${t.id}/edit`} className="block">
                          <TemplatePreviewThumb
                            config={parsed}
                            category={t.category}
                            previewImageUrl={previewImageUrl}
                            className="w-full rounded-t-xl rounded-b-none border-0 border-b border-border/60"
                          />
                        </Link>
                      ) : (
                        <TemplatePreviewThumb
                          config={parsed}
                          category={t.category}
                          previewImageUrl={previewImageUrl}
                          className="w-full rounded-t-xl rounded-b-none border-0 border-b border-border/60"
                        />
                      )}
                      <div className="absolute left-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 shadow-sm">
                        <LockIcon className="text-muted-foreground size-3.5" />
                      </div>
                    </div>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {userIsAdmin ? (
                          <Link href={`/templates/${t.id}/edit`} className="block min-w-0">
                            <p className="font-medium text-sm truncate" title={t.name}>
                              {t.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {t.category} · {t.aspect_ratio}
                            </p>
                          </Link>
                        ) : (
                          <>
                            <p className="font-medium text-sm truncate" title={t.name}>
                              {t.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {t.category} · {t.aspect_ratio}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {subscription.isPro && (
                          <DuplicateTemplateButton
                            templateId={t.id}
                            templateName={t.name}
                            category={t.category}
                            isPro={subscription.isPro}
                            atLimit={atTemplateLimit}
                          />
                        )}
                        {userIsAdmin && (
                          <Button variant="ghost" size="icon-xs" asChild>
                            <Link href={`/templates/${t.id}/edit`} aria-label={`Edit ${t.name}`}>
                              <PencilIcon className="size-3.5" />
                            </Link>
                          </Button>
                        )}
                        <DeleteTemplateButton
                          templateId={t.id}
                          templateName={t.name}
                          isPro={subscription.isPro}
                          isAdmin={userIsAdmin}
                          isSystemTemplate={true}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border/50 py-8 text-center text-sm">
              No system templates.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
