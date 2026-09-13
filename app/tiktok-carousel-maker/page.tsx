import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "TikTok Carousel Maker for Organic Product Marketing",
  description: "Create TikTok Photo Mode carousels that earn attention with useful content, then naturally bridge viewers to what you sell.",
  alternates: { canonical: "/tiktok-carousel-maker" },
};

export default function TikTokCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="TikTok" />;
}
