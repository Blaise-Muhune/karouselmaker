import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildCarouselPdfFromPngPages } from "./buildCarouselPdf";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8hAAAAABJRU5ErkJggg==",
  "base64"
);

describe("buildCarouselPdfFromPngPages", () => {
  it("creates one correctly sized PDF page for each rendered slide", async () => {
    const bytes = await buildCarouselPdfFromPngPages([ONE_PIXEL_PNG, ONE_PIXEL_PNG], 1080, 1350);
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getSize()).toEqual({ width: 1080, height: 1350 });
  });
});
