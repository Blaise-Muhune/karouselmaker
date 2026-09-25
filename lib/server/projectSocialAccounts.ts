import { getProject, updateProject } from "@/lib/server/db";
import type { Project, ProjectSocialAccounts } from "@/lib/server/db/types";

export type SocialPlatform = keyof ProjectSocialAccounts;

export async function saveProjectSocialAccount(
  userId: string,
  project: Project,
  platform: SocialPlatform,
  accountId: string
): Promise<void> {
  const current: ProjectSocialAccounts =
    project.social_accounts && typeof project.social_accounts === "object" ? project.social_accounts : {};
  if (current[platform] === accountId) return;
  await updateProject(userId, project.id, { social_accounts: { ...current, [platform]: accountId } });
}

const PROJECT_PATH = /^\/p\/([0-9a-f-]{36})(?:\/|$)/i;

/** After connecting from inside a project (return path /p/{id}/…), make that project use the new account. */
export async function rememberAccountForReturnPath(
  userId: string,
  returnTo: string,
  platform: SocialPlatform,
  accountId: string
): Promise<void> {
  const projectId = PROJECT_PATH.exec(returnTo)?.[1];
  if (!projectId || !accountId) return;
  try {
    const project = await getProject(userId, projectId);
    if (project) await saveProjectSocialAccount(userId, project, platform, accountId);
  } catch {
    // The connection itself succeeded; the project default is a convenience.
  }
}
