import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "TikTok Photo Carousel Generator with Captions",
  description: "Create scroll-stopping TikTok photo carousels from one project brief. Generate a clear title, editable slides, caption, hashtags, and a ready-to-upload ZIP.",
  openGraph: {
    title: "TikTok Photo Carousel Generator with Captions | Karouselmaker",
    description: "Build editable TikTok photo carousel slides, a caption, hashtags, and an export in one workspace.",
  },
  alternates: { canonical: "/tiktok-carousel-maker" },
};

export default function TikTokCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="TikTok" />;
}
