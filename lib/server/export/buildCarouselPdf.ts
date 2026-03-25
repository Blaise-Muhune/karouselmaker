import { PDFDocument } from "pdf-lib";

/**
 * One PDF page per slide, full-bleed PNG. Page size matches export pixels (points = px at 72 dpi scale).
 */
export async function buildCarouselPdfFromPngPages(
  pngBuffers: Buffer[],
  pageWidthPt: number,
  pageHeightPt: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (const buf of pngBuffers) {
    if (!buf?.length) continue;
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    const img = await pdfDoc.embedPng(new Uint8Array(buf));
    page.drawImage(img, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
  }
  return pdfDoc.save();
}
