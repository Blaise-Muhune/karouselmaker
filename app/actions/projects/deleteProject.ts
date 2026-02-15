"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, deleteProject as dbDeleteProject } from "@/lib/server/db";

export type DeleteProjectResult = { ok: true } | { ok: false; error: string };

export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  const { user } = await getUser();
  const project = await getProject(user.id, projectId);
  if (!project) {
    return { ok: false, error: "Project not found" };
  }
  const result = await dbDeleteProject(user.id, projectId);
  if (!result.ok) return result;
  revalidatePath("/projects");
  revalidatePath(`/p/${projectId}`);
  redirect("/projects");
}
