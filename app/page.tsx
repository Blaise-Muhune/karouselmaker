import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/server/auth/getUser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImageIcon, LayoutTemplateIcon, SparklesIcon } from "lucide-react";

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

      <section className="flex-1 flex flex-col items-center px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Carousel posts for Instagram and LinkedIn
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Enter a topic or paste a URL. Karouselmaker generates a full slide deck—headlines, body copy, and suggested images—in your project&apos;s voice. You edit, tweak layouts, and export PNGs ready to post.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                <SparklesIcon className="mr-2 size-5" />
                Get started free
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-4xl">
          <h2 className="text-center font-semibold text-foreground text-lg mb-8">How it works</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <LayoutTemplateIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Projects and templates</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Create a project per niche or client. Set your tone, colors, and watermark. Choose from layout templates—headline placement, image grids, overlays—and apply them per slide.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <SparklesIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">AI-generated content</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Paste a topic, article URL, or raw text. The AI drafts a hook, key points, and a call-to-action. You keep full control: edit any slide, reorder, or regenerate sections.
              </p>
            </li>
            <li className="rounded-xl border border-border/60 bg-card p-6 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <ImageIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Images and export</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Use your own uploads or AI-suggested stock images. Adjust gradient overlays for readability. Export a ZIP of 1080×1080 PNGs plus caption and hashtags.
              </p>
            </li>
          </ul>
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center text-muted-foreground text-sm">
          <p>
            Built for creators who ship. No design skills required—templates handle layout. You focus on the message.
          </p>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-5xl px-4 md:px-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Karouselmaker — creator-first carousel tool</span>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
