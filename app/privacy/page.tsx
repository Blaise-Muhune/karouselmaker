import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Karouselmaker.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="font-semibold text-lg hover:opacity-80">
            Karouselmaker
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <article className="flex-1 mx-auto max-w-3xl px-4 py-12 md:py-16 prose prose-neutral dark:prose-invert">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: January 2025</p>

        <section>
          <h2>1. Overview</h2>
          <p>
            Karouselmaker (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) respects your privacy. This policy describes
            what data we collect, how we use it, and your rights regarding that data.
          </p>
        </section>

        <section>
          <h2>2. Data We Collect</h2>
          <p>We collect:</p>
          <ul>
            <li><strong>Account data:</strong> Email, password (hashed), and profile information you provide when signing up.</li>
            <li><strong>Content data:</strong> Projects, carousels, slides, and assets you create and store in the Service.</li>
            <li><strong>Usage data:</strong> Logs of requests, errors, and interactions to operate and improve the Service.</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Provide, maintain, and improve the Service.</li>
            <li>Authenticate you and manage your account.</li>
            <li>Process AI-generated content and image searches (including via third-party APIs).</li>
            <li>Store your projects and exports.</li>
            <li>Respond to support requests and enforce our terms.</li>
          </ul>
        </section>

        <section>
          <h2>4. Third-Party Services</h2>
          <p>
            We use third-party services that may process your data:
          </p>
          <ul>
            <li><strong>Supabase:</strong> Authentication, database, and file storage.</li>
            <li><strong>OpenAI:</strong> AI text generation for carousel content.</li>
            <li><strong>Unsplash:</strong> Image search when you enable AI-suggested backgrounds.</li>
            <li><strong>Brave Search:</strong> Image search when configured as primary provider.</li>
          </ul>
          <p>
            Each provider has its own privacy policy. We do not control how they handle data. When you use images from
            Unsplash or other sources, attribution and licensing are your responsibility as stated in our Terms of Service.
          </p>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p>
            We retain your account and content data for as long as your account is active. You may delete your account
            and request deletion of associated data. We may retain certain data as required by law or for legitimate
            operational purposes (e.g., backups, fraud prevention).
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            We use industry-standard measures to protect your data, including encryption in transit and at rest.
            However, no system is completely secure; you use the Service at your own risk.
          </p>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <p>
            Depending on your jurisdiction, you may have the right to access, correct, delete, or port your data, or to
            object to or restrict certain processing. Contact us to exercise these rights.
          </p>
        </section>

        <section>
          <h2>8. Children</h2>
          <p>
            The Service is not intended for users under 13. We do not knowingly collect data from children under 13.
          </p>
        </section>

        <section>
          <h2>9. Changes</h2>
          <p>
            We may update this policy from time to time. Material changes will be communicated via the Service or email.
            Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            For privacy-related questions or requests, please contact us through the contact information provided in
            the application.
          </p>
        </section>
      </article>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-5xl px-4 md:px-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
        </div>
      </footer>
    </main>
  );
}
