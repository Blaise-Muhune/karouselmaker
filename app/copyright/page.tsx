import type { ReactNode } from "react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Copyright reporting",
  description: "How to report claimed copyright infringement involving Karouselmaker.",
  alternates: { canonical: "/copyright" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>{children}</section>;
}
function Copy({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-muted-foreground">{children}</p>;
}

export default function CopyrightPage() {
  return (
    <LegalPageShell title="Copyright reporting" updated="September 13, 2026">
      <Section title="1. How Karouselmaker handles content"><Copy>Karouselmaker stores private user workspaces and generates exports for the account that created them. It also lets users choose third-party image results or upload their own material. We respect intellectual-property rights and review credible reports of claimed infringement involving content hosted by the Service.</Copy></Section>
      <Section title="2. Report a claim">
        <Copy>Send a copyright report using Contact us in the footer. Use a clear title such as &quot;Copyright report&quot; and include:</Copy>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground"><li>Your name, email address, and electronic signature.</li><li>Identification of the copyrighted work you believe has been infringed.</li><li>A link, export identifier, or detailed description of the material you want us to review.</li><li>A statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law.</li><li>A statement that the information is accurate and that you are authorized to act for the copyright owner.</li></ul>
        <Copy>We may request more information, contact the relevant account holder when appropriate, and take action after review. This page does not make Karouselmaker the licensing authority for material hosted by third-party image sources.</Copy>
      </Section>
      <Section title="3. Counter-notices"><Copy>If we restrict content after a copyright report and you believe that decision was a mistake, contact us with a counter-notice. Identify the affected material, explain why the report is mistaken, include your contact details and electronic signature, and provide any information required by applicable law. We will review the counter-notice under the process that applies to the report.</Copy></Section>
      <Section title="4. Good-faith reports"><Copy>Please submit reports and counter-notices only in good faith. Knowingly false or misleading claims can create legal consequences. Users remain responsible for ensuring that their uploaded, imported, generated, and exported content can be used for their intended purpose.</Copy></Section>
    </LegalPageShell>
  );
}
