import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject } from "@/lib/server/db";
import { ProjectEditForm } from "./ProjectEditForm";

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
    },
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">Edit project</h1>
        <ProjectEditForm projectId={project.id} defaultValues={defaultValues} />
      </div>
    </div>
  );
}
