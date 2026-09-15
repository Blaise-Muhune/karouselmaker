/**
 * Font family IDs that are loaded from Google Fonts (preview + export).
 * Must match the subset of PREVIEW_FONTS that exist on fonts.google.com.
 */
export const GOOGLE_FONT_IDS = [
  "Inter",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Lato",
  "Poppins",
  "Work Sans",
  "Playfair Display",
  "Merriweather",
  "Libre Baskerville",
  "Source Sans 3",
  "Chonburi",
  "Instrument Serif",
  "Bodoni Moda",
  "Prata",
  "Arapey",
  "Fraunces",
  "Abril Fatface",
  "Limelight",
  "Syne",
  "Outfit",
  "Urbanist",
  "Sora",
] as const;

export const GOOGLE_FONT_IDS_SET = new Set<string>(GOOGLE_FONT_IDS);

/** Request only weights provided by each family; one invalid family rejects the stylesheet. */
const GOOGLE_FONT_WEIGHTS: Record<string, string> = {
  Inter: "100..900", Roboto: "100..900", Montserrat: "100..900",
  "Open Sans": "300..800", Lato: "100;300;400;700;900", Poppins: "100;200;300;400;500;600;700;800;900",
  "Work Sans": "100..900", "Playfair Display": "400..900", Merriweather: "300..900",
  "Libre Baskerville": "400;700", "Source Sans 3": "200..900", Chonburi: "400",
  "Instrument Serif": "400", "Bodoni Moda": "400..900", Prata: "400", Arapey: "400",
  Fraunces: "100..900", "Abril Fatface": "400", Limelight: "400", Syne: "400..800",
  Outfit: "100..900", Urbanist: "100..900", Sora: "100..800",
};

export function googleFontFamilyParam(id: string): string {
  return "family=" + encodeURIComponent(id).replace(/%20/g, "+") + ":wght@" + (GOOGLE_FONT_WEIGHTS[id] ?? "400;700");
}
