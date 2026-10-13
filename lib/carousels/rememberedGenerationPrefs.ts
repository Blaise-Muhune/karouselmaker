const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RememberedImageSource = "stock" | "library";

/** Last image choice and template (or template bundle) from a generated carousel. */
export type RememberedGenerationPrefs = {
  imageSource: RememberedImageSource;
  backgroundAssetIds: string[];
  templateIds: string[];
};

function uuidList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!UUID_RE.test(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Read the image selection and template/bundle saved on a carousel.
 * Returns null when the options object has neither.
 */
export function rememberedGenerationPrefsFromOptions(
  options: unknown,
  availableTemplateIds?: ReadonlySet<string>
): RememberedGenerationPrefs | null {
  if (!options || typeof options !== "object") return null;
  const opts = options as Record<string, unknown>;

  const hasImageSignal =
    "use_stock_photos" in opts ||
    "background_asset_ids" in opts ||
    "use_ai_backgrounds" in opts;
  const hasTemplateSignal = "template_id" in opts || "template_ids" in opts;
  if (!hasImageSignal && !hasTemplateSignal) return null;

  const backgroundAssetIds = uuidList(opts.background_asset_ids, 30);
  let templateIds = uuidList(opts.template_ids, 3);
  if (
    templateIds.length === 0 &&
    typeof opts.template_id === "string" &&
    UUID_RE.test(opts.template_id.trim())
  ) {
    templateIds = [opts.template_id.trim()];
  }
  if (availableTemplateIds) {
    templateIds = templateIds.filter((id) => availableTemplateIds.has(id));
  }

  let imageSource: RememberedImageSource = "stock";
  if (backgroundAssetIds.length > 0) imageSource = "library";
  else if (opts.use_stock_photos === true) imageSource = "stock";
  else if (opts.use_ai_backgrounds === false) imageSource = "library";

  return { imageSource, backgroundAssetIds, templateIds };
}
