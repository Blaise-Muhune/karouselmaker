import Link from "next/link";
import type { ReactNode } from "react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Karouselmaker.",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>{children}</section>;
}
function Copy({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-muted-foreground">{children}</p>;
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" updated="September 13, 2026">
      <Section title="1. Using Karouselmaker">
        <Copy>Karouselmaker helps you turn a project, product context, and topic into an editable social carousel. The Service can draft slide copy, captions, and hashtags; apply templates; use library or selected third-party images; and export individual images, ZIP files, or PDF documents where available.</Copy>
        <Copy>By creating an account or using the Service, you agree to these terms. If you use Karouselmaker for an organization, you confirm that you can accept these terms for that organization.</Copy>
      </Section>
      <Section title="2. Your account and access">
        <Copy>Keep your sign-in credentials secure and provide accurate account information. You are responsible for activity performed through your account. We may limit or suspend access when needed to protect the Service, comply with law, or address a material breach of these terms.</Copy>
      </Section>
      <Section title="3. Your content and generated drafts">
        <Copy>You retain your rights in the projects, prompts, copy, images, and other content you submit to Karouselmaker. You give us the limited permission needed to host, process, render, and export that content to operate the Service for you.</Copy>
        <Copy>AI output is a draft. Review it for accuracy, originality, audience fit, claims about products or people, and compliance before publishing. You decide whether and where to publish an export, and you are responsible for the final content you publish.</Copy>
      </Section>
      <Section title="4. Images and third-party material">
        <Copy>You may upload images from your device, import images you select from Google Drive, or use image results made available through third-party providers. You must have the rights, permissions, and releases needed for your intended use, including commercial use and any use of identifiable people, brands, or artwork.</Copy>
        <Copy>Third-party sources have their own licenses and terms. Web-search results in particular can be subject to copyright or other restrictions. Karouselmaker may include available attribution in an export, but attribution does not itself grant permission to use an image. Check the source and obtain permission when it is required.</Copy>
      </Section>
      <Section title="5. Plans, subscriptions, and post packs">
        <Copy>The Service may offer free generations, recurring Creator or Growth subscriptions, and one-time post packs. Current features, limits, prices, billing interval, and taxes (if applicable) are shown before checkout. Paid subscriptions renew until cancelled through the billing portal or as otherwise provided at checkout.</Copy>
        <Copy>Post packs add the stated number of generation credits after successful payment. We may change future prices or plan features with notice where required; a change does not alter a checkout already completed.</Copy>
      </Section>
      <Section title="6. Acceptable use">
        <Copy>You may not use the Service to violate law or another person&apos;s rights, including intellectual-property, privacy, publicity, or consumer-protection rights. You may not interfere with the Service, bypass limits or security measures, use another person&apos;s account without permission, or resell access without our written permission.</Copy>
      </Section>
      <Section title="7. Service availability and liability">
        <Copy>We work to keep Karouselmaker available, but generation, image search, exports, and third-party connections can be unavailable or change. We may update, replace, or discontinue features to operate and improve the Service. To the maximum extent permitted by law, Karouselmaker and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss arising from your publication or use of generated content or third-party material.</Copy>
      </Section>
      <Section title="8. Privacy, copyright, and changes">
        <Copy>Our handling of personal information is described in the <Link href="/privacy" className="text-primary underline hover:no-underline">Privacy Policy</Link>. To report claimed infringement, follow the instructions on our <Link href="/copyright" className="text-primary underline hover:no-underline">Copyright page</Link>. We may update these terms. The date above shows the latest version; continued use after an update means you accept the revised terms where permitted by law.</Copy>
      </Section>
      <Section title="9. Contact"><Copy>Use the Contact us link in the footer for questions about these terms or the Service.</Copy></Section>
    </LegalPageShell>
  );
}
