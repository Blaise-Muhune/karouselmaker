import { getHeadlineBodyMaxCharsFromTemplateConfig } from "@/lib/templates/zoneCharBudget";

/** Non-admin text/style saves must retain the visibility chosen by an admin. */
export function preserveTextVisibility(incoming: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> {
  const result = { ...incoming };
  for (const key of ["headline_zone_override", "body_zone_override"]) {
    const oldZone = existing[key] as Record<string, unknown> | undefined;
    const newZone = { ...(result[key] as Record<string, unknown> | undefined) };
    delete newZone.enabled;
    if (typeof oldZone?.enabled === "boolean") newZone.enabled = oldZone.enabled;
    if (Object.keys(newZone).length) result[key] = newZone;
    else delete result[key];
  }
  return result;
}

export function templateTextVisibilityChanged(before: unknown, after: unknown): boolean {
  const a = getHeadlineBodyMaxCharsFromTemplateConfig(before);
  const b = getHeadlineBodyMaxCharsFromTemplateConfig(after);
  return a.hasHeadline !== b.hasHeadline || a.hasBody !== b.hasBody;
}
