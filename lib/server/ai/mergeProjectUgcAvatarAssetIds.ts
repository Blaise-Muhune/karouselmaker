import { MAX_UGC_AVATAR_REFERENCE_ASSETS } from "@/lib/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** Dedupe, order-stable, cap — for vision + style-ref exclusion. */
export function mergeProjectUgcAvatarAssetIds(project: {
  ugc_character_avatar_asset_ids?: unknown;
  ugc_character_avatar_asset_id?: string | null;
}): string[] {
  const raw = project.ugc_character_avatar_asset_ids;
  const fromDb: string[] = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && isUuid(id))
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of fromDb) {
    const t = id.trim();
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_UGC_AVATAR_REFERENCE_ASSETS) return out;
  }
  if (out.length > 0) return out;
  const leg = project.ugc_character_avatar_asset_id?.trim();
  if (leg && isUuid(leg)) return [leg];
  return [];
}
