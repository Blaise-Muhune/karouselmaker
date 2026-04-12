"use server";

import { revalidatePath } from "next/cache";
import { buildDeterministicUgcSeriesBriefForSave } from "@/lib/server/ai/carouselSeriesVisualConsistency";
import { getUser } from "@/lib/server/auth/getUser";
import { UGC_CHARACTER_BRIEF_MAX_CHARS } from "@/lib/constants";
import { getCarousel } from "@/lib/server/db/carousels";
import { getProject, updateProject } from "@/lib/server/db/projects";
import { listSlides } from "@/lib/server/db/slides";
import { promoteCarouselGeneratedFacesToUgcAvatarAssets } from "@/lib/server/projects/promoteCarouselGeneratedFacesToUgcAvatarAssets";

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

/**
 * Saves the carousel’s recurring character lock to the project: text brief + a few AI slide images
 * copied into library as face references (when this run did not use the project’s saved face refs).
 */
export async function saveUgcCharacterBriefFromCarousel(
  projectId: string,
  carouselId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel || carousel.project_id !== projectId) {
    return { ok: false, error: "Carousel not found" };
  }

  const genOpts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  if (genOpts.use_ai_backgrounds !== true || genOpts.use_ai_generate !== true) {
    return { ok: false, error: "This carousel did not use AI-generated backgrounds." };
  }

  if (genOpts.ugc_used_project_avatar_refs === true) {
    return {
      ok: false,
      error:
        "This run already used your project’s saved face images—there’s no new AI-only character to save from it.",
    };
  }

  const slides = await listSlides(user.id, carouselId);
  const hasGeneratedUgcBackdrops = slides.some((s) => {
    const bg = s.background as { mode?: string; storage_path?: string } | null;
    const path = bg?.storage_path?.trim() ?? "";
    return (
      bg?.mode === "image" &&
      path.includes(`/generated/${carouselId}/`) &&
      path.startsWith(`user/${user.id}/`)
    );
  });

  const rawBrief = genOpts.ugc_series_character_brief;
  let brief = typeof rawBrief === "string" ? rawBrief.trim() : "";
  if (brief.length < 20) {
    brief = buildDeterministicUgcSeriesBriefForSave({
      carouselTitle: carousel.title,
      topic: carousel.input_value,
      slideCount: Math.max(1, slides.length),
      seedCharacterBrief: (project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() || undefined,
    })
      .trim()
      .slice(0, UGC_CHARACTER_BRIEF_MAX_CHARS);
  }

  if (brief.length < 20) {
    return { ok: false, error: "Could not build a character description for this carousel." };
  }

  if (!hasGeneratedUgcBackdrops) {
    return {
      ok: false,
      error: "No AI-generated slide backgrounds found—we need frames from this run to copy as face references.",
    };
  }

  const promoted = await promoteCarouselGeneratedFacesToUgcAvatarAssets({
    userId: user.id,
    userEmail: user.email,
    projectId,
    carouselId,
  });
  if (!promoted.ok) return promoted;

  await updateProject(user.id, projectId, {
    ugc_character_brief: brief,
    ugc_character_avatar_asset_ids: promoted.assetIds,
    ugc_character_avatar_asset_id: promoted.assetIds[0] ?? null,
    use_saved_ugc_character: true,
  });

  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/new`);
  revalidatePath(`/p/${projectId}/c/${carouselId}`);
  revalidatePath(`/projects/${projectId}/edit`);
  return { ok: true };
}
