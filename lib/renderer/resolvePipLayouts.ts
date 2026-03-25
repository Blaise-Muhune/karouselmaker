export type PipCorner = "top_left" | "top_right" | "bottom_left" | "bottom_right";

/** Partial overrides per PiP slot (saved on slide `image_display.pips`). */
export type PipSlotPartial = {
  pipPosition?: PipCorner;
  pipSize?: number;
  pipRotation?: number;
  pipBorderRadius?: number;
  pipX?: number;
  pipY?: number;
  zIndex?: number;
};

export type ResolvedPipLayout = {
  pipPosition: PipCorner;
  pipSize: number;
  pipRotation: number;
  pipBorderRadius: number;
  pipX?: number;
  pipY?: number;
  zIndex: number;
};

const CORNER_CYCLE: PipCorner[] = ["bottom_right", "bottom_left", "top_right", "top_left"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalizes legacy single-PiP root fields (`pipPosition`, `pipSize`, `pipX`/`pipY`, …) plus optional `pips[]`
 * into one resolved layout per image URL (preview + export share this).
 *
 * - Legacy slides: only root fields → slot 0 uses them; extra slots cycle corners and slightly smaller size.
 * - With `pips[i]`, partial fields fall back to root defaults per slot.
 */
export function resolvePipLayoutsForImageCount(imageDisplay: unknown, imageCount: number): ResolvedPipLayout[] | null {
  if (!isRecord(imageDisplay) || imageDisplay.mode !== "pip" || imageCount < 1) return null;

  const rootPipSize = typeof imageDisplay.pipSize === "number" ? imageDisplay.pipSize : 0.4;
  const rootRot = typeof imageDisplay.pipRotation === "number" ? imageDisplay.pipRotation : 0;
  const rootRadius = typeof imageDisplay.pipBorderRadius === "number" ? imageDisplay.pipBorderRadius : 24;
  const rootPos = (imageDisplay.pipPosition as PipCorner | undefined) ?? "bottom_right";
  const pipsRaw = imageDisplay.pips;

  const mergeSlot = (index: number, slot: Record<string, unknown> | undefined, defaultCorner: PipCorner): ResolvedPipLayout => {
    const pos = (slot?.pipPosition as PipCorner | undefined) ?? (index === 0 ? rootPos : defaultCorner);
    const size =
      typeof slot?.pipSize === "number"
        ? slot.pipSize
        : index === 0
          ? rootPipSize
          : Math.min(0.45, rootPipSize * 0.88);
    const rot = typeof slot?.pipRotation === "number" ? slot.pipRotation : rootRot;
    const radius = typeof slot?.pipBorderRadius === "number" ? slot.pipBorderRadius : rootRadius;
    const pipX =
      slot?.pipX != null
        ? Number(slot.pipX)
        : index === 0 && imageDisplay.pipX != null
          ? Number(imageDisplay.pipX)
          : undefined;
    const pipY =
      slot?.pipY != null
        ? Number(slot.pipY)
        : index === 0 && imageDisplay.pipY != null
          ? Number(imageDisplay.pipY)
          : undefined;
    const zIndex = typeof slot?.zIndex === "number" && !Number.isNaN(slot.zIndex) ? Math.round(slot.zIndex) : index;

    return {
      pipPosition: pos,
      pipSize: clamp(size, 0.25, 1),
      pipRotation: clamp(rot, -180, 180),
      pipBorderRadius: clamp(radius, 0, 72),
      ...(pipX != null && !Number.isNaN(pipX) ? { pipX: clamp(pipX, 0, 100) } : {}),
      ...(pipY != null && !Number.isNaN(pipY) ? { pipY: clamp(pipY, 0, 100) } : {}),
      zIndex,
    };
  };

  const out: ResolvedPipLayout[] = [];
  if (Array.isArray(pipsRaw) && pipsRaw.length > 0) {
    for (let i = 0; i < imageCount; i++) {
      const raw = pipsRaw[i];
      const slot = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
      out.push(mergeSlot(i, slot, CORNER_CYCLE[i % 4] ?? "bottom_right"));
    }
    return out;
  }

  for (let i = 0; i < imageCount; i++) {
    out.push(mergeSlot(i, undefined, CORNER_CYCLE[i % 4] ?? "bottom_right"));
  }
  return out;
}
