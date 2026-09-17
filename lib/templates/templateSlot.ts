/** One template: all slides. Two: first/last + middle. Three: first + middle + last. */
export function templateForSlide<T>(templates: readonly T[], slideIndex: number, totalSlides: number): T | undefined {
  if (templates.length < 2 || slideIndex <= 1) return templates[0];
  if (slideIndex >= totalSlides) return templates.length >= 3 ? templates[2] : templates[0];
  return templates[1];
}
