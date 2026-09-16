import type { Metadata } from "next";
import { PlatformCarouselLandingPage } from "@/components/landing/PlatformCarouselLandingPage";

export const metadata: Metadata = {
  title: "Instagram Carousel Generator with Templates & Captions",
  description: "Generate polished Instagram carousel posts from one project brief. Create the title, slides, caption, hashtags, and 4:5 export in one focused workspace.",
  openGraph: {
    title: "Instagram Carousel Generator with Templates & Captions | Karouselmaker",
    description: "Turn a project brief into an editable Instagram carousel, caption, hashtags, and ready-to-upload 4:5 slides.",
  },
  alternates: { canonical: "/instagram-carousel-maker" },
};

export default function InstagramCarouselMakerPage() {
  return <PlatformCarouselLandingPage platform="Instagram" />;
}
