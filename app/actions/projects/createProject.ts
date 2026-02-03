"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { createProject as dbCreateProject } from "@/lib/server/db";
import type { ProjectInsert } from "@/lib/server/db/types";
import { projectFormSchema, projectFormToDbPayload } from "@/lib/validations/project";

export async function createProject(formData: FormData) {
  const { user } = await getUser();

  const raw = {
    name: formData.get("name") as string,
    niche: (formData.get("niche") as string) ?? "",
    tone_preset: formData.get("tone_preset") as string,
    number_of_slides: Number(formData.get("number_of_slides")),
    do_rules: (formData.get("do_rules") as string) ?? "",
    dont_rules: (formData.get("dont_rules") as string) ?? "",
    primary_color: (formData.get("primary_color") as string) ?? "",
    secondary_color: (formData.get("secondary_color") as string) ?? "",
    watermark_text: (formData.get("watermark_text") as string) ?? "",
  };

  const parsed = projectFormSchema.safeParse({
    name: raw.name,
    niche: raw.niche,
    tone_preset: raw.tone_preset,
    slide_structure: { number_of_slides: raw.number_of_slides },
    voice_rules: { do_rules: raw.do_rules, dont_rules: raw.dont_rules },
    brand_kit: {
      primary_color: raw.primary_color,
      secondary_color: raw.secondary_color,
      watermark_text: raw.watermark_text,
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payload = projectFormToDbPayload(parsed.data);
  const project = await dbCreateProject(user.id, { ...payload, user_id: user.id } as ProjectInsert);
  redirect(`/p/${project.id}`);
}
