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
    content_focus: (formData.get("content_focus") as string) || "general",
    ugc_character_brief: (formData.get("ugc_character_brief") as string) ?? "",
    ugc_character_avatar_asset_id: (formData.get("ugc_character_avatar_asset_id") as string) ?? "",
    tone_preset: formData.get("tone_preset") as string,
    language: (formData.get("language") as string) || "en",
    number_of_slides: Number(formData.get("number_of_slides")),
    rules: (formData.get("rules") as string) ?? "",
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
    content_focus: raw.content_focus,
    ugc_character_brief: raw.ugc_character_brief,
    ugc_character_avatar_asset_id: raw.ugc_character_avatar_asset_id,
    tone_preset: raw.tone_preset,
    language: raw.language,
    slide_structure: { number_of_slides: raw.number_of_slides },
    project_rules: { rules: raw.rules },
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

  let project;
  try {
    project = await dbCreateProject(user.id, { ...payload, user_id: user.id } as ProjectInsert);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("duplicate key") ||
      message.includes("projects_user_id_name_key") ||
      message.includes("unique constraint")
    ) {
      return { error: { name: ["You already have a project with this name. Choose another."] } };
    }
    throw err;
  }

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile instanceof File && logoFile.size > 0) {
    const logoFd = new FormData();
    logoFd.set("logo", logoFile);
    await uploadProjectLogo(project.id, logoFd);
  }

  redirect(`/p/${project.id}`);
}
