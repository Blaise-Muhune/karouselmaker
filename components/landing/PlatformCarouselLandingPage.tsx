import { Link } from "next-view-transitions";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingMarketingFooter } from "@/components/landing/LandingMarketingFooter";
import { LandingMarketingHeader } from "@/components/landing/LandingMarketingHeader";

type Platform = "Instagram" | "TikTok";

const content = {
  Instagram: {
    eyebrow: "Instagram carousel maker for product marketers",
    headline: "Make Instagram carousels that give value before they sell.",
    intro: "Karouselmaker turns your niche and offer into a focused Instagram carousel. Each post opens with a problem your audience recognizes, earns the swipe with a useful payoff, and introduces your product only when it makes sense.",
    workflow: [
      ["Set the marketing context", "Add your niche, product website, or a plain-language description of what you sell."],
      ["Choose a topic worth saving", "Start with a suggested idea designed to help the audience, not an ad disguised as a post."],
      ["Export and publish", "Review the slide copy, make a light edit if needed, then download the carousel and caption."],
    ],
    questions: [
      ["Can I use this for an Instagram business account?", "Yes. It is built for people using carousels to grow awareness and softly lead viewers to a product, service, course, app, or store."],
      ["Do I need to design every slide?", "No. Karouselmaker uses a small set of templates so the work stays focused on the message, hook, and audience value."],
      ["Will every carousel be promotional?", "No. The system balances useful niche content and marketing posts, so a new account can build trust before it asks for attention."],
    ],
  },
  TikTok: {
    eyebrow: "TikTok carousel maker for organic product marketing",
    headline: "Create TikTok photo carousels people want to swipe through.",
    intro: "Karouselmaker helps you create TikTok carousel posts with a clear hook, a useful idea on every slide, and a natural product bridge. It is for founders and marketers who want organic reach without turning every post into a hard sell.",
    workflow: [
      ["Give the account context", "Tell us the niche and what you promote. Paste a website and we build an editable product brief from the public page."],
      ["Build a swipeable content arc", "Generate a concise post around a problem, opinion, tip, mistake, or insight your ideal audience already cares about."],
      ["Post with a complete caption", "Download the slides and a caption, then publish them as a TikTok photo carousel."],
    ],
    questions: [
      ["Is this for TikTok Photo Mode?", "Yes. Karouselmaker creates static carousel slides and captions for a photo-style post, rather than a talking-head or B-roll video script."],
      ["Can a new TikTok account use it?", "Yes. Each carousel is written to make sense to someone seeing the account for the first time."],
      ["How does it avoid sounding like an ad?", "The content starts with the audience problem or insight. Product context guides the post, but the offer appears only after the carousel has delivered value."],
    ],
  },
} as const;

export function PlatformCarouselLandingPage({ platform }: { platform: Platform }) {
  const page = content[platform];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingMarketingHeader />
      <article>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{page.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-balance font-[family-name:var(--font-landing-display)] text-4xl leading-[1.02] tracking-tight sm:text-6xl">
            {page.headline}
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{page.intro}</p>
          <Button size="lg" className="mt-9 h-11 gap-2 px-6" asChild>
            <Link href="/signup">Create your first carousel <ArrowRight className="size-4" /></Link>
          </Button>
        </section>

        <section className="border-y border-border/50 bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-xl font-[family-name:var(--font-landing-display)] text-3xl tracking-tight sm:text-4xl">A simple content workflow, not another design tool</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {page.workflow.map(([title, body], index) => <li key={title}><p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Step {index + 1}</p><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl tracking-tight sm:text-4xl">Questions about {platform} carousels</h2>
            <dl className="divide-y divide-border/60 border-y border-border/60">
              {page.questions.map(([question, answer]) => <div key={question} className="py-6"><dt className="font-medium">{question}</dt><dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd></div>)}
            </dl>
          </div>
        </section>
      </article>
      <LandingMarketingFooter />
    </main>
  );
}
