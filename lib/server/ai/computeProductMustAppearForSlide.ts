/**
 * Whether AI image generation should insist the product appears clearly in-frame.
 * When the user uploaded product reference pixels, we still vary by slide so the
 * carousel does not read as identical packshots on every frame.
 */
export function computeProductMustAppearForSlide(params: {
  slideIndex: number;
  slideCount: number;
  productPixelsAttached: boolean;
  productOrServiceKnown: boolean;
}): boolean {
  const idx = params.slideIndex;
  const n = params.slideCount;
  if (params.productPixelsAttached) {
    if (n <= 2) return true;
    if (idx === n) return true;
    if (idx === 1) return n <= 5;
    return idx % 2 === 0;
  }
  return (
    params.productOrServiceKnown &&
    (idx === 1 || idx === n || idx % 2 === 0)
  );
}
