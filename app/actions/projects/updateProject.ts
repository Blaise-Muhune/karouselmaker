"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, updateProject as dbUpdateProject } from "@/lib/server/db";
import type { ProjectUpdate } from "@/lib/server/db/types";
import { MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS } from "@/lib/constants";
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
    logo_storage_path: (formData.get("logo_storage_path") as string) ?? "",
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
      logo_storage_path: raw.logo_storage_path,
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

  let styleRefUpdate: { ai_style_reference_asset_ids: string[] } | undefined;
  const rawStyleRefs = formData.get("ai_style_reference_asset_ids");
  if (rawStyleRefs !== null) {
    const rawStr = typeof rawStyleRefs === "string" ? rawStyleRefs : "";
    try {
      const arr = JSON.parse(rawStr || "[]") as unknown;
      const uuid = z.string().uuid();
      const ids = Array.isArray(arr)
        ? arr
            .filter((x): x is string => typeof x === "string" && uuid.safeParse(x).success)
            .slice(0, MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS)
        : [];
      styleRefUpdate = { ai_style_reference_asset_ids: ids };
    } catch {
      styleRefUpdate = { ai_style_reference_asset_ids: [] };
    }
  }

  await dbUpdateProject(user.id, projectId, {
    ...(payload as ProjectUpdate),
    ...styleRefUpdate,
  });
  redirect(`/p/${projectId}`);
}
