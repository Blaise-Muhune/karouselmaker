"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, updateProject as dbUpdateProject } from "@/lib/server/db";
import type { ProjectUpdate } from "@/lib/server/db/types";
import { enrichProductContext, normalizeWebsiteUrl } from "@/lib/server/ai/enrichProductFromInput";
import {
  parseProjectRulesJson,
  projectFormSchema,
  projectFormToDbPayload,
} from "@/lib/validations/project";

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
    logo_storage_path: (formData.get("logo_storage_path") as string) ?? "",
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
      logo_storage_path: raw.logo_storage_path,
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const previous = parseProjectRulesJson(existing.project_rules);
  const productPrevious = raw.product_brief.trim()
    ? {
        ...previous,
        product_to_promote: parsed.data.project_rules.product_to_promote ?? "",
        product_url: normalizeWebsiteUrl(raw.product_brief_url),
        product_brief: raw.product_brief,
      }
    : previous;
  const product = await enrichProductContext(
    parsed.data.project_rules.product_to_promote ?? "",
    productPrevious,
    raw.product_url
  );
  const payload = projectFormToDbPayload(parsed.data, {
    product_url: product.product_url,
    product_brief: product.product_brief,
    pending_open_loop: previous.pending_open_loop,
    marketing_carousels_completed: previous.marketing_carousels_completed,
    digilaine_product_id: previous.digilaine_product_id,
  });

  await dbUpdateProject(user.id, projectId, payload as ProjectUpdate);
  redirect(`/p/${projectId}`);
}
