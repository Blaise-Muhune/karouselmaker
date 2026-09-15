import { GOOGLE_FONT_IDS, googleFontFamilyParam } from "@/lib/constants/googleFonts";

const HREF = "https://fonts.googleapis.com/css2?" +
  GOOGLE_FONT_IDS.map(googleFontFamilyParam).join("&") + "&display=swap";

/** Included in the initial HTML so fonts load before the editor hydrates. */
export function GoogleFontsLink() {
  return <link rel="stylesheet" href={HREF} />;
}
