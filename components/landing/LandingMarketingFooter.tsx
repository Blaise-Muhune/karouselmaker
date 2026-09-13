import { Link } from "next-view-transitions";
import { ContactUsModal } from "@/components/admin/ContactUsModal";

export function LandingMarketingFooter() {
  return (
    <footer className="border-t border-border/40 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6">
        <span className="font-[family-name:var(--font-landing-display)] text-base tracking-tight text-foreground">
          Karouselmaker
        </span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/instagram-carousel-maker" className="transition-colors hover:text-foreground">
            Instagram carousels
          </Link>
          <Link href="/tiktok-carousel-maker" className="transition-colors hover:text-foreground">
            TikTok carousels
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/copyright" className="transition-colors hover:text-foreground">
            Copyright
          </Link>
          <ContactUsModal userEmail="" />
        </div>
      </div>
    </footer>
  );
}
