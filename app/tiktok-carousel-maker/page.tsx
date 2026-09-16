import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "TikTok Carousel Maker for Product & Service Marketing",
  description: "Create value-first TikTok photo carousels that organically promote your product or service. Generate editable slides, captions, hashtags, and a ready-to-upload ZIP.",
  openGraph: {
    title: "TikTok Carousel Maker for Product & Service Marketing | Karouselmaker",
    description: "Build a useful TikTok photo carousel around your product or service, with editable slides, caption, hashtags, and an export.",
  },
  alternates: { canonical: "/tiktok-carousel-maker" },
};

export default function TikTokCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="TikTok" />;
}
