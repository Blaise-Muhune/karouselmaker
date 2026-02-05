import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { listTemplatesForUser, countUserTemplates } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import { Button } from "@/components/ui/button";
import { LockIcon, PencilIcon, PlusIcon } from "lucide-react";

export default async function TemplatesPage() {
  const { user } = await getUser();
  const [templates, subscription, userTemplateCount] = await Promise.all([
    listTemplatesForUser(user.id, { includeSystem: true }),
    getSubscription(user.id),
    countUserTemplates(user.id),
  ]);

  const systemTemplates = templates.filter((t) => t.user_id == null);
  const userTemplates = templates.filter((t) => t.user_id === user.id);
  const templateLimit = subscription.isPro ? PLAN_LIMITS.pro.customTemplates : PLAN_LIMITS.free.customTemplates;
  const atTemplateLimit = userTemplateCount >= templateLimit;

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-muted-foreground text-sm">
          Locked layouts for carousel slides. System templates are read-only. Pro users can change templates per slide in the editor.
        </p>

        {!subscription.isPro && (
          <UpgradeBanner
            message="Free plan: You can view templates but cannot change the layout per slide. Upgrade to Pro to pick templates when editing slides."
            variant="banner"
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System templates</CardTitle>
            <CardDescription>
              Pre-defined layouts (hook, point, context, cta, generic). Used when no template is chosen per slide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemTemplates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No system templates. Run the seed migration to add them.
              </p>
            ) : (
              <ul className="space-y-2">
                {systemTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="border-border flex items-center gap-3 rounded-lg border p-3"
                  >
                    <LockIcon className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Your templates</CardTitle>
                <CardDescription>
                  {subscription.isPro
                    ? `Custom templates (${userTemplateCount}/${templateLimit} used). Craft your own or quick-clone from system templates.`
                    : `Custom templates are Pro-only. Free plan: ${templateLimit} custom templates.`}
                </CardDescription>
              </div>
              {subscription.isPro && (
                <div className="flex flex-wrap gap-2">
                  {atTemplateLimit ? (
                    <Button size="sm" disabled className="gap-1.5">
                      <PlusIcon className="size-4" />
                      Craft template
                    </Button>
                  ) : (
                    <Button size="sm" asChild className="gap-1.5">
                      <Link href="/templates/new">
                        <PlusIcon className="size-4" />
                        Craft template
                      </Link>
                    </Button>
                  )}
                  {systemTemplates.length > 0 && !atTemplateLimit && (
                    <CreateTemplateDialog
                      systemTemplates={systemTemplates}
                      isPro={subscription.isPro}
                      atLimit={atTemplateLimit}
                    />
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!subscription.isPro && (
              <UpgradeBanner
                message="Create custom templates with Pro. Free plan uses system templates only."
                variant="inline"
              />
            )}
            {userTemplates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {subscription.isPro
                  ? "No custom templates yet. Craft one from scratch or quick-clone from a system template above."
                  : "No custom templates on free plan. Upgrade to Pro to create your own layouts."}
              </p>
            ) : (
              <ul className="space-y-2">
                {userTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="border-border flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
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
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
