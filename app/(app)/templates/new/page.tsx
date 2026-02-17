import Link from "next/link";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { countUserTemplates, listTemplatesForUser } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { TemplateBuilderForm } from "@/components/templates/TemplateBuilderForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export default async function NewTemplatePage() {
  const { user } = await getUser();
  const [subscription, userTemplateCount, templates] = await Promise.all([
    getSubscription(user.id, user.email),
    countUserTemplates(user.id),
    listTemplatesForUser(user.id, { includeSystem: true }),
  ]);

  const systemTemplates = templates.filter((t) => t.user_id == null);

  const limit = subscription.isPro ? PLAN_LIMITS.pro.customTemplates : PLAN_LIMITS.free.customTemplates;
  const atLimit = userTemplateCount >= limit;

  if (!subscription.isPro) {
    return (
      <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <UpgradeBanner
            message="Upgrade to Pro to create and customize your own templates."
            variant="banner"
          />
          <p className="text-muted-foreground text-sm">
            <Link href="/templates" className="underline hover:no-underline">
              ← Back to templates
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (atLimit) {
    return (
      <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="text-muted-foreground">
            You&apos;ve reached your template limit ({limit}). Delete a template to create a new one.
          </p>
          <Link href="/templates" className="text-sm underline hover:no-underline">
            ← Back to templates
          </Link>
        </div>
      </div>
    );
  }

  const baseOptions = systemTemplates
    .map((t) => {
      const config = templateConfigSchema.safeParse(t.config);
      return config.success ? { template: t, config: config.data } : null;
    })
    .filter((x): x is { template: (typeof systemTemplates)[0]; config: ReturnType<typeof templateConfigSchema.parse> } => x != null);

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <Breadcrumbs
              items={[
                { label: "Templates", href: "/templates" },
                { label: "New" },
              ]}
              className="mb-0.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
                <Link href="/templates">
                  <ArrowLeftIcon className="size-4" />
                  <span className="sr-only">Back to templates</span>
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">Create template</h1>
                <p className="text-muted-foreground text-sm">Configure layout, zones, and chrome</p>
              </div>
            </div>
          </div>
        </header>
        <TemplateBuilderForm
          mode="create"
          baseOptions={baseOptions}
          hideHeader
        />
      </div>
    </div>
  );
}
