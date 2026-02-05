import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ImageIcon,
  SparklesIcon,
  FolderOpenIcon,
  DownloadIcon,
  ArrowRightIcon,
} from "lucide-react";

export default async function Home() {
  const { user } = await getOptionalUser();
  if (user) redirect("/projects");

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

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center px-4 py-16 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-3xl text-center space-y-8 relative">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Carousel posts in{" "}
            <span className="text-primary">minutes</span>, not hours
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Enter a topic or paste a URL. AI generates a full slide deck—headlines, body copy, and suggested images. Edit, tweak layouts, and export PNGs ready for Instagram and LinkedIn.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/signup">
                <SparklesIcon className="size-5" />
                Get started free
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        {/* Demo: How it works */}
        <div className="mx-auto mt-24 md:mt-32 max-w-5xl w-full relative">
          <h2 className="text-center font-semibold text-foreground text-xl md:text-2xl mb-4">
            How it works
          </h2>
          <p className="text-center text-muted-foreground text-sm md:text-base mb-12 max-w-xl mx-auto">
            Four simple steps from idea to ready-to-post carousel
          </p>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="relative">
              <div className="rounded-xl border border-border bg-card p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                    1
                  </div>
                  <h3 className="font-semibold text-foreground">Create a project</h3>
                </div>
                <p className="text-muted-foreground text-sm flex-1">
                  Set up a project for your niche or client. Add your brand colors, watermark, and tone of voice.
                </p>
                <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
                  e.g. &quot;Fitness tips&quot;, &quot;SaaS marketing&quot;
                </div>
              </div>
              <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 text-muted-foreground/50">
                <ArrowRightIcon className="size-6" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="rounded-xl border border-border bg-card p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                    2
                  </div>
                  <h3 className="font-semibold text-foreground">Enter topic or URL</h3>
                </div>
                <p className="text-muted-foreground text-sm flex-1">
                  Paste a topic, article URL, or raw text. Choose how many slides you want.
                </p>
                <div className="mt-4 rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs">
                  <span className="text-muted-foreground">&quot;5 habits of successful founders&quot;</span>
                </div>
              </div>
              <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 text-muted-foreground/50">
                <ArrowRightIcon className="size-6" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="rounded-xl border border-border bg-card p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                    3
                  </div>
                  <h3 className="font-semibold text-foreground">AI generates</h3>
                </div>
                <p className="text-muted-foreground text-sm flex-1">
                  The AI drafts a hook, key points, and CTA. Optionally adds suggested background images per slide.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <SparklesIcon className="size-4 text-amber-500" />
                  <span>Hook → Points → CTA in seconds</span>
                </div>
              </div>
              <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 text-muted-foreground/50">
                <ArrowRightIcon className="size-6" />
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="rounded-xl border border-border bg-card p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                    4
                  </div>
                  <h3 className="font-semibold text-foreground">Edit & export</h3>
                </div>
                <p className="text-muted-foreground text-sm flex-1">
                  Tweak any slide—headlines, templates, backgrounds. Export a ZIP of PNGs plus caption and hashtags.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <DownloadIcon className="size-4" />
                  <span>1080×1080 ready to post</span>
                </div>
              </div>
            </div>
          </div>

          {/* Demo mockup: example slides */}
          <div className="mt-16 rounded-2xl border border-border bg-muted/30 p-6 md:p-8">
            <h3 className="text-center font-semibold text-foreground mb-6">
              Example output
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
              {[
                { title: "5 habits of successful founders", type: "hook", num: "1" },
                { title: "Wake up at 5am", type: "point", num: "2" },
                { title: "Read 30 min daily", type: "point", num: "3" },
                { title: "Follow @you for more", type: "cta", num: "4" },
              ].map((slide) => (
                <div
                  key={slide.num}
                  className="shrink-0 w-[200px] md:w-[240px] aspect-square rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm"
                >
                  <div className="h-full flex flex-col p-4 justify-between bg-gradient-to-b from-muted/50 to-muted">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {slide.type}
                    </span>
                    <p className="text-sm font-semibold text-foreground line-clamp-3">
                      {slide.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{slide.num}/4</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-muted-foreground text-xs mt-4">
              Each slide uses locked templates—you edit text and images, not layout. No design skills needed.
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div className="mx-auto mt-24 max-w-4xl">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <FolderOpenIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Projects & templates</h3>
              <p className="text-muted-foreground text-sm mt-1">
                One project per niche. Locked layout templates—hook, point, context, CTA. Apply per slide.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <SparklesIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">AI-generated content</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Topic or URL in, full deck out. Edit any slide, reorder, or regenerate. You keep full control.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <ImageIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Images & export</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Your uploads or AI-suggested stock images. Gradient overlays. Export ZIP with caption and credits.
              </p>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-20 max-w-2xl text-center">
          <div className="rounded-2xl border border-border bg-card p-8 md:p-10">
            <h3 className="font-semibold text-foreground text-lg mb-2">
              Ready to create?
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              No design skills required. Templates handle layout. You focus on the message.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup" className="gap-2">
                <SparklesIcon className="size-5" />
                Get started free
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 mt-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Karouselmaker — creator-first carousel tool</span>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
