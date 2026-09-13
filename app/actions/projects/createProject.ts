"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { createProject as dbCreateProject } from "@/lib/server/db";
import type { ProjectInsert } from "@/lib/server/db/types";
import { enrichProductContext, normalizeWebsiteUrl } from "@/lib/server/ai/enrichProductFromInput";
import { projectFormSchema, projectFormToDbPayload } from "@/lib/validations/project";
import { uploadProjectLogo } from "./uploadProjectLogo";

export async function createProject(formData: FormData) {
  const { user } = await getUser();

  const raw = {
    name: formData.get("name") as string,
    niche: (formData.get("niche") as string) ?? "",
    tone_preset: formData.get("tone_preset") as string,
    language: (formData.get("language") as string) || "en",
    number_of_slides: Number(formData.get("number_of_slides")) || 5,
    rules: (formData.get("rules") as string) ?? "",
    product_to_promote: (formData.get("product_to_promote") as string) ?? "",
    product_url: (formData.get("product_url") as string) ?? "",
    product_brief: (formData.get("product_brief") as string) ?? "",
    product_brief_url: (formData.get("product_brief_url") as string) ?? "",
    organic_marketing_progress: Number(formData.get("organic_marketing_progress") ?? 0),
    primary_color: (formData.get("primary_color") as string) ?? "",
    secondary_color: (formData.get("secondary_color") as string) ?? "",
    watermark_text: (formData.get("watermark_text") as string) ?? "",
  };

  const parsed = projectFormSchema.safeParse({
    name: raw.name,
    niche: raw.niche,
    tone_preset: raw.tone_preset,
    language: raw.language,
    slide_structure: { number_of_slides: raw.number_of_slides },
    project_rules: {
      rules: raw.rules,
      product_to_promote: raw.product_to_promote,
      organic_marketing_progress: raw.organic_marketing_progress,
    },
    brand_kit: {
      primary_color: raw.primary_color,
      secondary_color: raw.secondary_color,
      watermark_text: raw.watermark_text,
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const product = await enrichProductContext(
    parsed.data.project_rules.product_to_promote ?? "",
    raw.product_brief.trim()
      ? {
          product_to_promote: parsed.data.project_rules.product_to_promote ?? "",
          product_url: normalizeWebsiteUrl(raw.product_brief_url),
          product_brief: raw.product_brief,
        }
      : undefined,
    raw.product_url
  );
  const payload = projectFormToDbPayload(parsed.data, {
    product_url: product.product_url,
    product_brief: product.product_brief,
  });

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

  // Seed AI topic lineup for the default new-post flow (soft-fail if AI unavailable).
  try {
    const { ensureProjectTopicLineup } = await import(
      "@/app/actions/carousels/projectTopicSuggestions"
    );
    await ensureProjectTopicLineup(project.id, "instagram");
  } catch {
    // Queue can be filled when opening New post.
  }

  // Land on new post so the first win is generate, not an empty posts list.
  redirect(`/p/${project.id}/new`);
}
