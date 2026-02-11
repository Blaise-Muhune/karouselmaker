import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { countUserTemplates, listTemplatesForUser } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { TemplateBuilderForm } from "@/components/templates/TemplateBuilderForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import Link from "next/link";

export default async function NewTemplatePage() {
  const { user } = await getUser();
  const [subscription, userTemplateCount, templates] = await Promise.all([
    getSubscription(user.id),
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
      <div className="mx-auto max-w-4xl">
        <TemplateBuilderForm mode="create" baseOptions={baseOptions} />
      </div>
    </div>
  );
}
