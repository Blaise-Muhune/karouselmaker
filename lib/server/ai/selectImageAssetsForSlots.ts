/**
 * Pick the requested number of image slots from a user's selected assets.
 * A slot gets a different image while possible; only a smaller selection is repeated.
 */
export function selectImageAssetsForSlots<T>(
  assets: readonly T[],
  slotCount: number,
  random: () => number = Math.random
): T[] {
  if (assets.length === 0 || slotCount <= 0) return [];

  const shuffled = [...assets];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selectedIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[selectedIndex]] = [shuffled[selectedIndex]!, shuffled[index]!];
  }

  return Array.from({ length: slotCount }, (_, index) => shuffled[index % shuffled.length]!);
}
