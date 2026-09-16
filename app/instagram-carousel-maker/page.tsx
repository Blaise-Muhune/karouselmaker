import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "Instagram Carousel Maker for Product & Service Marketing",
  description: "Create value-first Instagram carousels that organically promote your product or service without feeling like ads. Generate editable slides, captions, hashtags, and a 4:5 export.",
  openGraph: {
    title: "Instagram Carousel Maker for Product & Service Marketing | Karouselmaker",
    description: "Turn your product or service context into a useful Instagram carousel, caption, hashtags, and ready-to-upload 4:5 slides.",
  },
  alternates: { canonical: "/instagram-carousel-maker" },
};

export default function InstagramCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="Instagram" />;
}
