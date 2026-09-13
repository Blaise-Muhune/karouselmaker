import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject } from "@/lib/server/db";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProjectEditForm } from "./ProjectEditForm";
import { parseProjectRulesJson } from "@/lib/validations/project";
import { ArrowLeftIcon } from "lucide-react";

export default async function EditProjectPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { user } = await getUser();
  const { id } = await params;
  const project = await getProject(user.id, id);

  if (!project) notFound();

  const rulesParsed = parseProjectRulesJson(project.project_rules);
  const slideStructure = project.slide_structure as { number_of_slides?: number } | undefined;
  const brandKit = project.brand_kit as {
    primary_color?: string;
    secondary_color?: string;
    watermark_text?: string;
    logo_storage_path?: string;
  } | undefined;
  const projectWithLang = project as { language?: string };
  const slides = slideStructure?.number_of_slides;
  const defaultValues = {
    name: project.name,
    niche: project.niche ?? "",
    tone_preset: project.tone_preset as "neutral" | "funny" | "serious" | "savage" | "inspirational",
    language: projectWithLang.language ?? "en",
    slide_structure: {
      number_of_slides: slides && slides >= 3 && slides <= 7 ? slides : 5,
    },
    project_rules: {
      rules: rulesParsed.rules,
      product_to_promote: rulesParsed.product_to_promote,
      organic_marketing_progress: rulesParsed.organic_marketing_progress,
    },
    brand_kit: {
      primary_color: brandKit?.primary_color ?? "",
      secondary_color: brandKit?.secondary_color ?? "",
      watermark_text: brandKit?.watermark_text ?? "",
      logo_storage_path: brandKit?.logo_storage_path ?? "",
    },
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
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
            <p className="text-muted-foreground text-sm mt-0.5">
              Niche, product context, and brand basics for organic Instagram & TikTok carousels.
            </p>
          </div>
        </div>
        <ProjectEditForm
          projectId={project.id}
          defaultValues={defaultValues}
          productBrief={rulesParsed.product_brief}
          productUrl={rulesParsed.product_url}
        />
      </div>
    </div>
  );
}
