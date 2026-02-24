import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ContactUsModal } from "@/components/admin/ContactUsModal";

export const metadata = {
  title: "Copyright / DMCA",
  description: "Copyright and DMCA policy for Karouselmaker.",
};

export default function CopyrightPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Copyright / DMCA</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Last updated: January 2025</p>

          <div className="mt-8 sm:mt-10 space-y-8 sm:space-y-10 text-sm sm:text-base text-foreground">
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Designated agent</h2>
              <p className="text-muted-foreground leading-relaxed">
                Karouselmaker respects intellectual property rights. Under the Digital Millennium Copyright Act (DMCA)
                and similar laws, we have designated an agent to receive notices of claimed copyright infringement.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">DMCA designated agent:</strong><br />
                Karouselmaker Copyright Agent<br />
                Email: copyright@karouselmaker.com
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Reporting infringement</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you believe content on or through the Service infringes your copyright, send a written notice to the
                designated agent above. Your notice must include:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
                <li>Your physical or electronic signature.</li>
                <li>Identification of the copyrighted work you claim has been infringed.</li>
                <li>Identification of the material that is claimed to be infringing and information reasonably sufficient to locate it (e.g. URL, description).</li>
                <li>Your contact information (address, phone, email).</li>
                <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement that the information in the notice is accurate and, under penalty of perjury, that you are authorized to act on behalf of the copyright owner.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                We may forward the notice to the user who posted the content and may remove or disable access to the
                material in response to a valid notice. We may terminate accounts of repeat infringers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Counter-notice</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you believe your content was removed or disabled by mistake or misidentification, you may send a
                counter-notice to the designated agent. It must include your physical or electronic signature,
                identification of the material that was removed and its location before removal, a statement under
                penalty of perjury that you have a good-faith belief the material was removed by mistake, your name and
                contact information, and consent to the jurisdiction of the federal court for your district (or any
                judicial district in which we may be found). We may restore the material if the copyright claimant does
                not file a court action within a specified period.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Misrepresentation</h2>
              <p className="text-muted-foreground leading-relaxed">
                Under the DMCA, anyone who knowingly materially misrepresents that material is infringing, or that
                material was removed by mistake, may be liable for damages. Do not submit a notice or counter-notice
                unless you have a good-faith belief in the facts you state.
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
            <Link href="/copyright" className="hover:text-foreground transition-colors">Copyright</Link>
            <ContactUsModal userEmail="" />
          </div>
        </div>
      </footer>
    </main>
  );
}
