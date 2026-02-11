import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getTemplate } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { TemplateBuilderForm } from "@/components/templates/TemplateBuilderForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getUser();
  const [template, subscription] = await Promise.all([
    getTemplate(user.id, id),
    getSubscription(user.id),
  ]);

  if (!template) notFound();
  if (template.user_id !== user.id) notFound();

  if (!subscription.isPro) {
    return (
      <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <UpgradeBanner
            message="Upgrade to Pro to edit custom templates."
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

  const config = templateConfigSchema.safeParse(template.config);
  if (!config.success) {
    return (
      <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="text-destructive">Invalid template config. Cannot edit.</p>
          <Link href="/templates" className="text-sm underline hover:no-underline">
            ← Back to templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <TemplateBuilderForm
          mode="edit"
          templateId={id}
          initialName={template.name}
          initialCategory={template.category}
          initialConfig={config.data}
        />
      </div>
    </div>
  );
}
