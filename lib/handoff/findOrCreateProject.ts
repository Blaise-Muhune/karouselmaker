import { createProject, listProjects } from "@/lib/server/db/projects";
import type { Project } from "@/lib/server/db/types";
import { PRODUCT_TO_PROMOTE_MAX_CHARS } from "@/lib/constants";
import {
  findProjectForDigilaineProductId,
  uniqueProjectName,
  type DigilaineKarouselHandoffPayload,
} from "@/lib/handoff/digilaineHandoff";

export async function findOrCreateProjectFromDigilaineHandoff(
  userId: string,
  payload: DigilaineKarouselHandoffPayload,
): Promise<Project> {
  const projects = await listProjects(userId);
  const existing = findProjectForDigilaineProductId(projects, payload.product_id);
  if (existing) return existing;

  const name = uniqueProjectName(
    payload.product_title,
    projects.map((p) => p.name),
  );
  const brief = payload.product_brief.trim().slice(0, PRODUCT_TO_PROMOTE_MAX_CHARS);
  return createProject(userId, {
    user_id: userId,
    name,
    niche: null,
    tone_preset: "neutral",
    language: "en",
    project_rules: {
      rules: "",
      product_to_promote: brief,
      product_url: payload.product_url?.trim() || null,
      product_brief: brief,
      organic_marketing_progress: 0,
      digilaine_product_id: payload.product_id,
    },
    slide_structure: { number_of_slides: 5 },
    brand_kit: {},
    sources: {},
  });
}
