import { Link } from "next-view-transitions";
import { ContactUsModal } from "@/components/admin/ContactUsModal";

export function LandingMarketingFooter() {
  return (
    <footer className="border-t border-border/50 py-6 mt-12 sm:mt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
        <span>Karouselmaker</span>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/copyright" className="hover:text-foreground transition-colors">
            Copyright
          </Link>
          <ContactUsModal userEmail="" />
        </div>
      </div>
    </footer>
  );
}
