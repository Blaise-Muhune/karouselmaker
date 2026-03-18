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
