import Link from "next/link";
import type { ReactNode } from "react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Karouselmaker.",
  alternates: { canonical: "/privacy" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>{children}</section>;
}
function Copy({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-muted-foreground">{children}</p>;
}
function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="September 13, 2026">
      <Section title="1. What this policy covers"><Copy>This policy explains how Karouselmaker handles information when you use our website and carousel-creation service. It applies to information we collect directly from you and information created while providing the Service.</Copy></Section>
      <Section title="2. Information we handle">
        <List>
          <li><strong className="text-foreground">Account information:</strong> your email address, sign-in provider details, and account profile data.</li>
          <li><strong className="text-foreground">Creation workspace:</strong> project details, product context, topics, prompts, slide copy, captions, hashtags, template choices, and generated carousel data.</li>
          <li><strong className="text-foreground">Assets:</strong> images you upload, images you choose to import from Google Drive, and image-source details needed to render and credit selected third-party images.</li>
          <li><strong className="text-foreground">Billing records:</strong> subscription status, post-pack credits, Stripe customer identifiers, and checkout records. Payment-card details are collected and processed by Stripe, not stored by Karouselmaker.</li>
          <li><strong className="text-foreground">Support and operations:</strong> messages you send through Contact us and technical request or error information used to operate, secure, and troubleshoot the Service.</li>
        </List>
      </Section>
      <Section title="3. How we use information"><List><li>Authenticate you, save your workspace, and render or export your carousels.</li><li>Generate requested drafts, captions, hashtags, and related carousel content.</li><li>Process subscriptions and post-pack purchases, apply plan limits, and prevent fraud or misuse.</li><li>Answer support requests, diagnose errors, protect the Service, and meet legal obligations.</li></List></Section>
      <Section title="4. Service providers and connections">
        <Copy>We use service providers to run Karouselmaker. Depending on the features you use, they may process information needed to deliver that feature:</Copy>
        <List>
          <li><strong className="text-foreground">Supabase and managed cloud storage:</strong> account authentication and storage of your assets.</li>
          <li><strong className="text-foreground">Managed database infrastructure:</strong> account, project, carousel, and subscription records.</li>
          <li><strong className="text-foreground">OpenAI:</strong> prompts and relevant project content sent to create the AI drafts you request. API inputs are not used to train OpenAI models by default; see <a href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint" target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">OpenAI&apos;s API data controls</a>.</li>
          <li><strong className="text-foreground">Stripe:</strong> secure checkout, subscriptions, and post-pack payments.</li>
          <li><strong className="text-foreground">Resend:</strong> delivery of messages submitted through Contact us.</li>
          <li><strong className="text-foreground">Google Drive:</strong> only when you choose to import images. The app uses the <code className="text-xs">drive.file</code> permission to access files or folders you select for import, then saves the imported images to your Karouselmaker library. We do not use Google Drive data for advertising.</li>
          <li><strong className="text-foreground">Image sources:</strong> your search query and chosen source are sent to the relevant third-party image provider when you request a stock or web image.</li>
        </List>
      </Section>
      <Section title="5. Cookies and session data"><Copy>We use essential session cookies to keep you signed in and protect authenticated actions. If we add optional analytics or advertising technologies that require notice or consent, we will update this policy and the relevant in-product notice.</Copy></Section>
      <Section title="6. Retention and deletion"><Copy>We keep account and workspace data while your account is active and for a reasonable period afterward for backups, security, billing, dispute resolution, and legal compliance. You can remove content from the Service where deletion controls are available. To request access, correction, or deletion of personal data, use Contact us. We may need to retain limited information when law or legitimate operational needs require it.</Copy></Section>
      <Section title="7. Security"><Copy>We use reasonable technical and organizational measures designed to protect information. No online service can guarantee absolute security, so please use a unique password and keep account access private.</Copy></Section>
      <Section title="8. Your rights and choices"><Copy>Privacy laws in your location may give you rights to request access, correction, deletion, portability, or to object to certain processing. Use Contact us to make a request. We may need to verify your identity and will respond as required by applicable law.</Copy></Section>
      <Section title="9. Updates and contact"><Copy>We may update this policy as the Service changes. The date above identifies the latest version. For privacy questions or requests, use Contact us in the footer. Your use of images and third-party material is also covered by our <Link href="/terms" className="text-primary underline hover:no-underline">Terms of Service</Link>.</Copy></Section>
    </LegalPageShell>
  );
}
