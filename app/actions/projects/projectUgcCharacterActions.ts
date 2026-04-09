"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getCarousel } from "@/lib/server/db/carousels";
import { getProject, updateProject } from "@/lib/server/db/projects";
import { UGC_CHARACTER_BRIEF_MAX_CHARS } from "@/lib/constants";

export async function updateProjectUseSavedUgcCharacter(
  projectId: string,
  useSaved: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found" };
  await updateProject(user.id, projectId, { use_saved_ugc_character: useSaved });
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/new`);
  return { ok: true };
}

export async function saveUgcCharacterBriefFromCarousel(
  projectId: string,
  carouselId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel || carousel.project_id !== projectId) {
    return { ok: false, error: "Carousel not found" };
  }
  const opts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  const raw = opts.ugc_series_character_brief;
  if (typeof raw !== "string" || raw.trim().length < 20) {
    return { ok: false, error: "This carousel has no saved character description to copy." };
  }
  const brief = raw.trim().slice(0, UGC_CHARACTER_BRIEF_MAX_CHARS);
  await updateProject(user.id, projectId, { ugc_character_brief: brief });
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/new`);
  revalidatePath(`/p/${projectId}/c/${carouselId}`);
  revalidatePath(`/projects/${projectId}/edit`);
  return { ok: true };
}
