import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { listTemplatesForUser, countUserTemplates } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import Link from "next/link";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import { DuplicateTemplateButton } from "@/components/templates/DuplicateTemplateButton";
import { Button } from "@/components/ui/button";
import { LockIcon, PencilIcon, PlusIcon } from "lucide-react";

export default async function TemplatesPage() {
  const { user } = await getUser();
  const [templates, subscription, userTemplateCount] = await Promise.all([
    listTemplatesForUser(user.id, { includeSystem: true }),
    getSubscription(user.id, user.email),
    countUserTemplates(user.id),
  ]);

  const systemTemplates = templates.filter((t) => t.user_id == null);
  const userTemplates = templates.filter((t) => t.user_id === user.id);
  const templateLimit = subscription.isPro ? PLAN_LIMITS.pro.customTemplates : PLAN_LIMITS.free.customTemplates;
  const atTemplateLimit = userTemplateCount >= templateLimit;

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        {!subscription.isPro && (
          <UpgradeBanner
            message="Free: View templates only. Upgrade to Pro to pick templates when editing slides."
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
            <Button
              variant={atTemplateLimit ? "outline" : "default"}
              size="sm"
              className="mt-4 gap-1.5"
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
          )}
        </header>

        {/* Your templates */}
        <section className="mb-10">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Your templates
          </p>
          {userTemplates.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {userTemplates.map((t) => (
                <li key={t.id}>
                  <div className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-lg">
                    <Link
                      href={`/templates/${t.id}/edit`}
                      className="min-w-0 flex-1"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
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
                      />
                    </div>
                  </div>
                </li>
              ))}
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
            <ul className="divide-y divide-border/50">
              {systemTemplates.map((t) => (
                <li key={t.id}>
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <LockIcon className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </div>
                    {subscription.isPro && (
                      <DuplicateTemplateButton
                        templateId={t.id}
                        templateName={t.name}
                        category={t.category}
                        isPro={subscription.isPro}
                        atLimit={atTemplateLimit}
                      />
                    )}
                  </div>
                </li>
              ))}
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
