import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject } from "@/lib/server/db";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProjectEditForm } from "./ProjectEditForm";
import { ArrowLeftIcon } from "lucide-react";

export default async function EditProjectPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { user } = await getUser();
  const { id } = await params;
  const project = await getProject(user.id, id);

  if (!project) notFound();

  const voiceRules = project.voice_rules as { do_rules?: string; dont_rules?: string } | undefined;
  const slideStructure = project.slide_structure as { number_of_slides?: number } | undefined;
  const brandKit = project.brand_kit as {
    primary_color?: string;
    secondary_color?: string;
    watermark_text?: string;
    logo_storage_path?: string;
  } | undefined;

  const defaultValues = {
    name: project.name,
    niche: project.niche ?? "",
    tone_preset: project.tone_preset as "neutral" | "funny" | "serious" | "savage" | "inspirational",
    slide_structure: { number_of_slides: slideStructure?.number_of_slides ?? 8 },
    voice_rules: {
      do_rules: voiceRules?.do_rules ?? "",
      dont_rules: voiceRules?.dont_rules ?? "",
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
      <div className="mx-auto max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: project.name, href: `/p/${project.id}` },
            { label: "Edit project" },
          ]}
          className="mb-2"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href={`/p/${project.id}`}>
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to project</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Edit project</h1>
        </div>
        <ProjectEditForm projectId={project.id} defaultValues={defaultValues} />
      </div>
    </div>
  );
}
