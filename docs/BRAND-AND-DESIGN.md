# Karouselmaker — Brand, Design & App Description

Use this document for promotional videos or marketing assets.

---

## Product Description

**Karouselmaker** is an AI-powered carousel generator for content creators. Users create projects, paste a topic or URL, and the AI generates viral-style carousel slides. Templates handle layout; no design skills are needed.

**Tagline:** *Grow faster with carousels* — Topic in, carousel out. No design skills needed—just your ideas.

**Value proposition:** Carousels drive 3–5× more engagement than single-image posts. Karouselmaker handles the design so creators can focus on ideas.

---

## User Flow (4 steps)

1. **Create project** — Brand, niche, tone (e.g. "Fitness tips")
2. **Enter topic** — Paste topic or URL (e.g. "5 habits of founders")
3. **Slides drafted** — AI generates hook, points, CTA
4. **Edit & export** — Tweak, reorder, export PNGs (1080×1080, 1080×1350, 1080×1920)

---

## Color Palette

### Light mode

| Role        | OKLCH                    | Approx Hex | Usage                          |
|-------------|--------------------------|------------|--------------------------------|
| Primary     | oklch(0.55 0.17 163)     | ~#22b573   | Buttons, accents, brand        |
| Primary fg  | oklch(0.985 0 0)         | ~#fafafa   | Text on primary buttons        |
| Background  | oklch(1 0 0)             | #ffffff    | Page background                |
| Foreground  | oklch(0.145 0 0)         | ~#252525   | Main text                      |
| Muted       | oklch(0.97 0 0)          | ~#f7f7f7   | Cards, subtle surfaces         |
| Muted fg    | oklch(0.556 0 0)         | ~#8c8c8c   | Secondary text                 |
| Border      | oklch(0.922 0 0)         | ~#ebebeb   | Borders, dividers              |
| Accent      | oklch(0.97 0 0)          | ~#f7f7f7   | Hover states                   |
| Destructive | oklch(0.577 0.245 27.3)  | ~#dc2626   | Errors, delete actions         |

**Primary hue:** 163 (teal/green)

### Dark mode

| Role        | OKLCH                     | Usage                |
|-------------|---------------------------|----------------------|
| Background  | oklch(0.145 0.02 163)     | Gradient base        |
| Primary     | oklch(0.72 0.17 163)      | Brighter teal        |
| Muted       | oklch(0.22 0.03 163)      | Card backgrounds     |
| Border      | oklch(0.5 0.05 163 / 25%) | Subtle borders       |

Dark background gradient: `160deg, oklch(0.16 0.028 163) → oklch(0.14 0.02 163) → oklch(0.12 0.015 170)`.

---

## Typography & Layout

- **Font stack:** Geist (Vercel), -apple-system, Segoe UI, Roboto, Arial, sans-serif
- **Border radius:** 0.625rem (--radius), cards use rounded-xl
- **Hierarchy:** Bold headings, medium body, small muted labels (uppercase, tracking-wider)

---

## Brand Elements

- **Logo:** Minimal carousel icon — stacked rectangles with horizontal lines (stacked slides)
- **Icon:** SVG viewBox 0 0 24 24, stroke-based, rounded corners
- **Favicon / Apple icon:** `logo.png` (square PNG)

---

## UI Patterns

- Cards: `rounded-xl border border-border/50 bg-muted/5`, hover `border-primary/30`
- Primary buttons: solid primary color, shadow, hover scale ~1.02
- Secondary elements: `bg-primary/10 text-primary` for icon badges
- Step numbers: `rounded-full bg-primary text-primary-foreground`, 8–9px
- Hero accent: `from-primary/5 via-transparent` gradient overlay

---

## Key Screens / Sections

1. **Landing**
   - Hero: “Grow faster with carousels” (carousels in primary)
   - CTA: “Get started free”, “Sign in”
   - Hero carousel preview: scrollable mock carousel (hook, points, CTA)
   - “How it works” 4-step cards
   - “Features” — Projects & templates, Content drafted, Export ready
   - Outcome: “Carousels drive 3–5× more engagement…”
   - Final CTA: “Ready to ship your first carousel?”

2. **Carousel editor**
   - Slide grid (1080×1080 or 1080×1350 or 1080×1920)
   - Export: PNG/ZIP + video preview (slideshow) + MP4 via FFmpeg.wasm

3. **Output**
   - Instagram-style carousel slides
   - Export sizes: 1080×1080, 1080×1350, 1080×1920

---

## Marketing Angles for Promo Video

- Creator-first, fast workflow
- Topic/URL → AI slides in seconds
- Locked templates, no design skills
- Export PNGs + video preview
- Mobile-friendly (add to home screen)

---

## Technical Stack (for context)

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (Auth, DB, Storage)
- AI slide generation, Playwright for export
- Image slideshow for video preview (all devices), FFmpeg.wasm for MP4 download
