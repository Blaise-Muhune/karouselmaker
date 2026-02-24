"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getTemplate } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/** Returns parsed template config for a given template id, or null if not found / invalid. */
export async function getTemplateConfigAction(
  templateId: string
): Promise<TemplateConfig | null> {
  const { user } = await getUser();
  if (!user) return null;

  const template = await getTemplate(user.id, templateId);
  if (!template?.config) return null;

  const parsed = templateConfigSchema.safeParse(template.config);
  return parsed.success ? parsed.data : null;
}
