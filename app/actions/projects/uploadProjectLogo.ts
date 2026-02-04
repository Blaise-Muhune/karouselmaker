"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getProject, updateProject } from "@/lib/server/db";
import { uploadUserAsset } from "@/lib/server/storage/upload";

const BUCKET = "carousel-assets";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB for logo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export type UploadProjectLogoResult =
  | { ok: true; storagePath: string }
  | { ok: false; error: string };

/**
 * Upload a logo for a project. Saves to user/{userId}/projects/{projectId}/logo.{ext}
 * and updates the project's brand_kit.logo_storage_path.
 */
export async function uploadProjectLogo(
  projectId: string,
  formData: FormData
): Promise<UploadProjectLogoResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found" };

  const file = formData.get("logo") as File | null;
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No logo file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Logo must be JPEG, PNG, WebP, or SVG" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "Logo must be 2MB or smaller" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["jpg", "jpeg", "png", "webp", "svg"].includes(ext) ? ext : "png";
  const fileName = `logo.${safeExt}`;
  const storagePath = `user/${user.id}/projects/${projectId}/${fileName}`;

  try {
    const buffer = await file.arrayBuffer();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (error) throw new Error(error.message);

    const brandKit = (project.brand_kit as Record<string, unknown>) ?? {};
    const updated = { ...brandKit, logo_storage_path: storagePath };
    await updateProject(user.id, projectId, { brand_kit: updated });

    return { ok: true, storagePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}
