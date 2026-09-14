"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, deleteProject as dbDeleteProject, listStoredExportsByProject } from "@/lib/server/db";
import { removeStoredExportFiles } from "@/lib/server/storage/exportRetention";

export type DeleteProjectResult = { ok: true } | { ok: false; error: string };

export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  const { user } = await getUser();
  const project = await getProject(user.id, projectId);
  if (!project) {
    return { ok: false, error: "Project not found" };
  }
  try {
    const exports = await listStoredExportsByProject(user.id, projectId);
    for (const exported of exports) await removeStoredExportFiles(exported);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove project export files" };
  }
  const result = await dbDeleteProject(user.id, projectId);
  if (!result.ok) return result;
  revalidatePath("/projects");
  revalidatePath(`/p/${projectId}`);
  redirect("/projects");
}
