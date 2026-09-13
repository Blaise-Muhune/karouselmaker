import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "Instagram Carousel Maker for Organic Product Marketing",
  description: "Create Instagram carousels that teach first and softly promote your product. Build a focused post from your niche, offer, and audience context.",
  alternates: { canonical: "/instagram-carousel-maker" },
};

export default function InstagramCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="Instagram" />;
}
