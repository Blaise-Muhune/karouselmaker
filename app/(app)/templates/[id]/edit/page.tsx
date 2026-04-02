import { getUser } from "@/lib/server/auth/getUser";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getAsset, getTemplate } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { TemplateBuilderForm } from "@/components/templates/TemplateBuilderForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

const ASSETS_BUCKET = "carousel-assets";

export default async function EditTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const refRaw = sp.refAsset;
  const refAssetId =
    typeof refRaw === "string" && /^[0-9a-f-]{36}$/i.test(refRaw.trim()) ? refRaw.trim() : undefined;
  const { user } = await getUser();
  const userIsAdmin = isAdmin(user.email ?? null);
  const [template, fullAccess] = await Promise.all([
    getTemplate(user.id, id),
    hasFullProFeatureAccess(user.id, user.email),
  ]);

  if (!template) notFound();
  const isSystemTemplate = template.user_id == null;
  const canEdit = template.user_id === user.id || (isSystemTemplate && userIsAdmin);
  if (!canEdit) notFound();

  const canEditWithoutPro = isSystemTemplate && userIsAdmin;
  if (!fullAccess && !canEditWithoutPro) {
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

  let importReferenceImageUrl: string | null = null;
  if (refAssetId) {
    const asset = await getAsset(user.id, refAssetId);
    if (asset?.user_id === user.id && asset.storage_path) {
      try {
        importReferenceImageUrl = await getSignedImageUrl(ASSETS_BUCKET, asset.storage_path, 3600);
      } catch {
        importReferenceImageUrl = null;
      }
    }
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
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <Breadcrumbs
              items={[
                { label: "Templates", href: "/templates" },
                { label: template.name },
                { label: "Edit" },
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
                <h1 className="text-xl font-semibold tracking-tight truncate">{template.name}</h1>
                <p className="text-muted-foreground text-sm">Edit layout, zones, and chrome</p>
              </div>
            </div>
          </div>
        </header>
        <TemplateBuilderForm
          mode="edit"
          templateId={id}
          initialName={template.name}
          initialCategory={template.category}
          initialConfig={config.data}
          hideHeader
          importReferenceImageUrl={importReferenceImageUrl}
        />
      </div>
    </div>
  );
}
