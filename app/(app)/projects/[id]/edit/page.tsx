import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getProject } from "@/lib/server/db";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProjectEditForm } from "./ProjectEditForm";
import { mergeProjectUgcAvatarAssetIds } from "@/lib/server/ai/mergeProjectUgcAvatarAssetIds";
import { normalizeContentFocusId } from "@/lib/server/ai/projectContentFocus";
import { getEffectivePlanLimits } from "@/lib/server/subscription";
import { ArrowLeftIcon } from "lucide-react";

export default async function EditProjectPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { user } = await getUser();
  const { id } = await params;
  const project = await getProject(user.id, id);

  if (!project) notFound();

  const limits = await getEffectivePlanLimits(user.id, user.email);

  const projectRulesJson = project.project_rules as { rules?: string; do_rules?: string; dont_rules?: string } | undefined;
  const rulesValue =
    projectRulesJson?.rules?.trim() ||
    (projectRulesJson?.do_rules || projectRulesJson?.dont_rules
      ? [projectRulesJson?.do_rules && `Do: ${projectRulesJson.do_rules}`, projectRulesJson?.dont_rules && `Don't: ${projectRulesJson.dont_rules}`].filter(Boolean).join("\n\n")
      : "");
  const slideStructure = project.slide_structure as { number_of_slides?: number } | undefined;
  const brandKit = project.brand_kit as {
    primary_color?: string;
    secondary_color?: string;
    watermark_text?: string;
    logo_storage_path?: string;
  } | undefined;
  const postTo = project.post_to_platforms as { facebook?: boolean; tiktok?: boolean; instagram?: boolean; linkedin?: boolean; youtube?: boolean } | undefined;
  const styleRefIds = (
    Array.isArray(project.ai_style_reference_asset_ids)
      ? project.ai_style_reference_asset_ids.filter((id): id is string => typeof id === "string")
      : []
  ).slice(0, limits.maxProjectStyleReferenceAssets);

  const projectWithLang = project as { language?: string };
  const defaultValues = {
    name: project.name,
    niche: project.niche ?? "",
    content_focus: normalizeContentFocusId(project.content_focus),
    ugc_character_brief: (project as { ugc_character_brief?: string | null }).ugc_character_brief ?? "",
    ugc_character_avatar_asset_ids: mergeProjectUgcAvatarAssetIds(project).slice(
      0,
      limits.maxUgcAvatarReferenceAssets
    ),
    tone_preset: project.tone_preset as "neutral" | "funny" | "serious" | "savage" | "inspirational",
    language: projectWithLang.language ?? "en",
    slide_structure: { number_of_slides: slideStructure?.number_of_slides ?? 8 },
    project_rules: { rules: rulesValue },
    brand_kit: {
      primary_color: brandKit?.primary_color ?? "",
      secondary_color: brandKit?.secondary_color ?? "",
      watermark_text: brandKit?.watermark_text ?? "",
      logo_storage_path: brandKit?.logo_storage_path ?? "",
    },
    post_to_platforms: {
      facebook: !!postTo?.facebook,
      tiktok: !!postTo?.tiktok,
      instagram: !!postTo?.instagram,
      linkedin: !!postTo?.linkedin,
      youtube: !!postTo?.youtube,
    },
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: project.name, href: `/p/${project.id}` },
            { label: "Edit project" },
          ]}
          className="mb-2"
        />
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href={`/p/${project.id}`}>
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to project</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Edit project</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your project is where your carousels live. Change name and niche here; use Advanced settings for language, tone, and brand.</p>
          </div>
        </div>
        <ProjectEditForm
          projectId={project.id}
          defaultValues={defaultValues}
          initialAiStyleReferenceAssetIds={styleRefIds}
          maxProjectStyleReferenceAssets={limits.maxProjectStyleReferenceAssets}
          maxUgcAvatarReferenceAssets={limits.maxUgcAvatarReferenceAssets}
          isAdmin={isAdmin(user.email ?? null)}
        />
      </div>
    </div>
  );
}
