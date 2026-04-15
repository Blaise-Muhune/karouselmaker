"use client";

import { useEffect } from "react";
import { FONT_WEIGHT_GOOGLE_WGHT_PARAM } from "@/lib/constants/fontWeight";
import { GOOGLE_FONT_IDS } from "@/lib/constants/googleFonts";

const HREF =
  "https://fonts.googleapis.com/css2?" +
  GOOGLE_FONT_IDS.map(
    (id) => `family=${encodeURIComponent(id).replace(/%20/g, "+")}:wght@${FONT_WEIGHT_GOOGLE_WGHT_PARAM}`
  ).join("&") +
  "&display=swap";

/** Injects Google Fonts stylesheet into document head so preview/editor can render our font options. */
export function GoogleFontsLink() {
  useEffect(() => {
    const existing = document.querySelector(`link[href="${HREF}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link);
  }, []);
  return null;
}
