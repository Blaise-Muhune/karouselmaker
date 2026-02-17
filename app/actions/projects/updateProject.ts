"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, updateProject as dbUpdateProject } from "@/lib/server/db";
import type { ProjectUpdate } from "@/lib/server/db/types";
import { projectFormSchema, projectFormToDbPayload } from "@/lib/validations/project";

export async function updateProject(projectId: string, formData: FormData) {
  const { user } = await getUser();

  const existing = await getProject(user.id, projectId);
  if (!existing) {
    return { error: "Project not found." };
  }

  const raw = {
    name: formData.get("name") as string,
    niche: (formData.get("niche") as string) ?? "",
    tone_preset: formData.get("tone_preset") as string,
    language: (formData.get("language") as string) || "en",
    number_of_slides: Number(formData.get("number_of_slides")),
    do_rules: (formData.get("do_rules") as string) ?? "",
    dont_rules: (formData.get("dont_rules") as string) ?? "",
    primary_color: (formData.get("primary_color") as string) ?? "",
    secondary_color: (formData.get("secondary_color") as string) ?? "",
    watermark_text: (formData.get("watermark_text") as string) ?? "",
    logo_storage_path: (formData.get("logo_storage_path") as string) ?? "",
  };

  const parsed = projectFormSchema.safeParse({
    name: raw.name,
    niche: raw.niche,
    tone_preset: raw.tone_preset,
    language: raw.language,
    slide_structure: { number_of_slides: raw.number_of_slides },
    voice_rules: { do_rules: raw.do_rules, dont_rules: raw.dont_rules },
    brand_kit: {
      primary_color: raw.primary_color,
      secondary_color: raw.secondary_color,
      watermark_text: raw.watermark_text,
      logo_storage_path: raw.logo_storage_path,
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payload = projectFormToDbPayload(parsed.data);
  await dbUpdateProject(user.id, projectId, payload as ProjectUpdate);
  redirect(`/p/${projectId}`);
}
