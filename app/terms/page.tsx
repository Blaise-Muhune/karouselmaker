import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ContactUsModal } from "@/components/admin/ContactUsModal";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Karouselmaker.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity">
            Karouselmaker
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <article className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14 md:py-16">
        <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 md:p-10 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Last updated: January 2025</p>

          <div className="mt-8 sm:mt-10 space-y-8 sm:space-y-10 text-sm sm:text-base text-foreground">
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using Karouselmaker (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">2. Description of Service</h2>
          <p className="text-muted-foreground leading-relaxed">
            Karouselmaker is a web application that helps creators generate swipe-style carousel posts for social media.
            The Service uses AI to generate text content and provides templates for layout. Images may be sourced from
            third-party providers including Unsplash and Brave Search.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">3. User Responsibilities</h2>
          <p className="text-muted-foreground leading-relaxed">
            You are responsible for all content you create, publish, or export using the Service. You must ensure that:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>Your use of the Service complies with applicable laws and platform policies (e.g., Instagram, LinkedIn).</li>
            <li>You have the right to use any content you upload or incorporate into your carousels.</li>
            <li>
              <strong>Image attribution:</strong> When you use images from third-party sources (e.g., Unsplash, Brave Search)
              in your carousels or exports, <strong>you are solely responsible for providing proper attribution to the
              original authors</strong>. The Service may include attribution information in exports where available; it is
              your obligation to include such attribution when publishing or distributing your work. Failure to attribute
              may violate the terms of the image provider and applicable copyright or licensing requirements.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">4. Third-Party Content</h2>
          <p className="text-muted-foreground leading-relaxed">
            Images provided through the Service may come from Unsplash, Brave Search, or other third-party sources.
            Each provider has its own terms and licensing. You must comply with those terms when using their content.
            Karouselmaker does not guarantee the availability, accuracy, or licensing of third-party content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">5. Account and Data</h2>
          <p className="text-muted-foreground leading-relaxed">
            You must provide accurate information when creating an account. You are responsible for maintaining the
            security of your credentials. We process your data in accordance with our{" "}
            <Link href="/privacy" className="text-primary underline hover:no-underline">Privacy Policy</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">6. Acceptable Use</h2>
          <p className="text-muted-foreground leading-relaxed">You may not use the Service to:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>Violate any law or third-party rights.</li>
            <li>Generate or distribute harmful, misleading, or illegal content.</li>
            <li>Abuse, overload, or attempt to compromise the Service or its infrastructure.</li>
            <li>Resell or redistribute the Service without authorization.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">7. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            Karouselmaker and its branding, templates, and software remain our property. You retain ownership of content
            you create. By using the Service, you grant us a limited license to process and store your content as needed
            to provide the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">8. Disclaimers</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service is provided &quot;as is.&quot; We do not warrant uninterrupted access, accuracy of AI-generated content,
            or compatibility with third-party platforms. We are not liable for how you use exported content or for any
            attribution or licensing issues arising from third-party images.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Use of generated content:</strong> We are not responsible for what you decide to do with carousels you
            generate using the Service. You alone are responsible for how you publish, distribute, or otherwise use your
            exported content, including compliance with laws and platform policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">9. Refunds</h2>
          <p className="text-muted-foreground leading-relaxed">
            All payments are final. We do not offer refunds for subscriptions or other purchases. If you cancel a
            subscription, you retain access until the end of your billing period.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, Karouselmaker and its operators shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">11. Changes</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update these terms from time to time. Continued use of the Service after changes constitutes
            acceptance. Material changes will be communicated via the Service or email where appropriate.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">12. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For questions about these terms, please contact us through the contact information provided in the
            application or on our website.
          </p>
        </section>
          </div>
        </div>
      </article>

      <footer className="border-t py-6 mt-8 sm:mt-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <span>Karouselmaker</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <ContactUsModal userEmail="" />
          </div>
        </div>
      </footer>
    </main>
  );
}
