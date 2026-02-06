import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ContactUsModal } from "@/components/admin/ContactUsModal";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Karouselmaker.",
};

export default function PrivacyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Last updated: January 2025</p>

          <div className="mt-8 sm:mt-10 space-y-8 sm:space-y-10 text-sm sm:text-base text-foreground">
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">1. Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            Karouselmaker (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) respects your privacy. This policy describes
            what data we collect, how we use it, and your rights regarding that data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">2. Data We Collect</h2>
          <p className="text-muted-foreground leading-relaxed">We collect:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li><strong>Account data:</strong> Email, password (hashed), and profile information you provide when signing up.</li>
            <li><strong>Content data:</strong> Projects, carousels, slides, and assets you create and store in the Service.</li>
            <li><strong>Usage data:</strong> Logs of requests, errors, and interactions to operate and improve the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
          <p className="text-muted-foreground leading-relaxed">We use your data to:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>Provide, maintain, and improve the Service.</li>
            <li>Authenticate you and manage your account.</li>
            <li>Process AI-generated content and image searches (including via third-party APIs).</li>
            <li>Store your projects and exports.</li>
            <li>Respond to support requests and enforce our terms.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">4. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use third-party services that may process your data:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li><strong>Supabase:</strong> Authentication, database, and file storage.</li>
            <li><strong>OpenAI:</strong> AI text generation for carousel content.</li>
            <li><strong>Unsplash:</strong> Image search when you enable AI-suggested backgrounds.</li>
            <li><strong>Brave Search:</strong> Image search when configured as primary provider.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Each provider has its own privacy policy. We do not control how they handle data. When you use images from
            Unsplash or other sources, attribution and licensing are your responsibility as stated in our{" "}
            <Link href="/terms" className="text-primary underline hover:no-underline">Terms of Service</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">5. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your account and content data for as long as your account is active. You may delete your account
            and request deletion of associated data. We may retain certain data as required by law or for legitimate
            operational purposes (e.g., backups, fraud prevention).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">6. Refunds</h2>
          <p className="text-muted-foreground leading-relaxed">
            We do not offer refunds for subscriptions or other purchases. See our{" "}
            <Link href="/terms" className="text-primary underline hover:no-underline">Terms of Service</Link> for details.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">7. Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use industry-standard measures to protect your data, including encryption in transit and at rest.
            However, no system is completely secure; you use the Service at your own risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">8. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed">
            Depending on your jurisdiction, you may have the right to access, correct, delete, or port your data, or to
            object to or restrict certain processing. Contact us to exercise these rights.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">9. Use of Generated Content</h2>
          <p className="text-muted-foreground leading-relaxed">
            We are not responsible for what you decide to do with carousels you generate using the Service. You alone
            are responsible for how you publish, distribute, or otherwise use your exported content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">10. Children</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service is not intended for users under 13. We do not knowingly collect data from children under 13.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">11. Changes</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this policy from time to time. Material changes will be communicated via the Service or email.
            Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">12. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For privacy-related questions or requests, please contact us through the contact information provided in
            the application.
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
