import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

export type ImportReferenceImageSlot = {
  image_url: string;
  storage_path: string;
  asset_id: string;
};

/**
 * Merge the user's uploaded import image into template defaults as the default background (same shape as Save as template).
 * Forces allowImage true so previews and new slides show the photo instead of a mistaken solid-only read.
 */
export function applyImportReferenceImageToConfig(
  config: TemplateConfig,
  slot: ImportReferenceImageSlot
): TemplateConfig {
  const existingBg =
    config.defaults?.background && typeof config.defaults.background === "object" && !Array.isArray(config.defaults.background)
      ? { ...(config.defaults.background as Record<string, unknown>) }
      : {};

  const defaultOverlay = {
    gradient: true,
    darken: 0.5,
    color: "#000000",
    textColor: "#ffffff",
    gradientOn: true,
  };
  const existingOverlay =
    existingBg.overlay && typeof existingBg.overlay === "object" && !Array.isArray(existingBg.overlay)
      ? { ...defaultOverlay, ...(existingBg.overlay as Record<string, unknown>) }
      : defaultOverlay;

  const meta =
    config.defaults?.meta && typeof config.defaults.meta === "object" && !Array.isArray(config.defaults.meta)
      ? { ...(config.defaults.meta as Record<string, unknown>) }
      : {};

  const currentImgDisp =
    meta.image_display && typeof meta.image_display === "object" && !Array.isArray(meta.image_display)
      ? (meta.image_display as Record<string, unknown>)
      : {};

  const mode = currentImgDisp.mode === "pip" ? "pip" : "full";
  const image_display =
    mode === "pip"
      ? { ...currentImgDisp, mode: "pip" as const }
      : {
          ...currentImgDisp,
          mode: "full" as const,
          position: (currentImgDisp.position as string | undefined) ?? "center",
          fit: (currentImgDisp.fit as string | undefined) ?? "cover",
        };

  return {
    ...config,
    backgroundRules: {
      ...config.backgroundRules,
      allowImage: true,
      defaultStyle: config.backgroundRules?.defaultStyle ?? "darken",
    },
    defaults: {
      ...config.defaults,
      background: {
        ...existingBg,
        mode: "image",
        images: [
          {
            image_url: slot.image_url,
            storage_path: slot.storage_path,
            asset_id: slot.asset_id,
            alternates: [],
          },
        ],
        overlay: existingOverlay,
      },
      meta: { ...meta, image_display },
    },
  };
}
