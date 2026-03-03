"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { createProject as dbCreateProject } from "@/lib/server/db";
import type { ProjectInsert } from "@/lib/server/db/types";
import { projectFormSchema, projectFormToDbPayload } from "@/lib/validations/project";
import { uploadProjectLogo } from "./uploadProjectLogo";

export async function createProject(formData: FormData) {
  const { user } = await getUser();

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
    post_facebook: formData.get("post_facebook") === "on" || formData.get("post_facebook") === "true",
    post_tiktok: formData.get("post_tiktok") === "on" || formData.get("post_tiktok") === "true",
    post_instagram: formData.get("post_instagram") === "on" || formData.get("post_instagram") === "true",
    post_linkedin: formData.get("post_linkedin") === "on" || formData.get("post_linkedin") === "true",
    post_youtube: formData.get("post_youtube") === "on" || formData.get("post_youtube") === "true",
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
    },
    post_to_platforms: {
      facebook: raw.post_facebook,
      tiktok: raw.post_tiktok,
      instagram: raw.post_instagram,
      linkedin: raw.post_linkedin,
      youtube: raw.post_youtube,
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payload = projectFormToDbPayload(parsed.data);
  const project = await dbCreateProject(user.id, { ...payload, user_id: user.id } as ProjectInsert);

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile instanceof File && logoFile.size > 0) {
    const logoFd = new FormData();
    logoFd.set("logo", logoFile);
    await uploadProjectLogo(project.id, logoFd);
  }

  redirect(`/p/${project.id}`);
}
