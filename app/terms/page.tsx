import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Karouselmaker.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground text-sm">Last updated: January 2025</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Karouselmaker (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            Karouselmaker is a web application that helps creators generate swipe-style carousel posts for social media.
            The Service uses AI to generate text content and provides templates for layout. Images may be sourced from
            third-party providers including Unsplash and Brave Search.
          </p>
        </section>

        <section>
          <h2>3. User Responsibilities</h2>
          <p>
            You are responsible for all content you create, publish, or export using the Service. You must ensure that:
          </p>
          <ul>
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

        <section>
          <h2>4. Third-Party Content</h2>
          <p>
            Images provided through the Service may come from Unsplash, Brave Search, or other third-party sources.
            Each provider has its own terms and licensing. You must comply with those terms when using their content.
            Karouselmaker does not guarantee the availability, accuracy, or licensing of third-party content.
          </p>
        </section>

        <section>
          <h2>5. Account and Data</h2>
          <p>
            You must provide accurate information when creating an account. You are responsible for maintaining the
            security of your credentials. We process your data in accordance with our{" "}
            <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>.
          </p>
        </section>

        <section>
          <h2>6. Acceptable Use</h2>
          <p>You may not use the Service to:</p>
          <ul>
            <li>Violate any law or third-party rights.</li>
            <li>Generate or distribute harmful, misleading, or illegal content.</li>
            <li>Abuse, overload, or attempt to compromise the Service or its infrastructure.</li>
            <li>Resell or redistribute the Service without authorization.</li>
          </ul>
        </section>

        <section>
          <h2>7. Intellectual Property</h2>
          <p>
            Karouselmaker and its branding, templates, and software remain our property. You retain ownership of content
            you create. By using the Service, you grant us a limited license to process and store your content as needed
            to provide the Service.
          </p>
        </section>

        <section>
          <h2>8. Disclaimers</h2>
          <p>
            The Service is provided &quot;as is.&quot; We do not warrant uninterrupted access, accuracy of AI-generated content,
            or compatibility with third-party platforms. We are not liable for how you use exported content or for any
            attribution or licensing issues arising from third-party images.
          </p>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Karouselmaker and its operators shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2>10. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes constitutes
            acceptance. Material changes will be communicated via the Service or email where appropriate.
          </p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>
            For questions about these terms, please contact us through the contact information provided in the
            application or on our website.
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
