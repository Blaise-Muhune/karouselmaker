# Karouselmaker — Brand, Design & App Description

Use this document for promotional videos or marketing assets.

---

## Product Description

**Karouselmaker** is a marketing tool for organic Instagram & TikTok carousels that promote your product—without sounding like ads. Users create a project (niche + offer), pick a topic, and the AI drafts problem-first swipe slides. Templates handle layout; you tweak message and photos, then export.

**Tagline:** *Organic Instagram & TikTok carousels that market your product—without sounding like ads.*

**Value proposition:** Carousels grow accounts; Karouselmaker turns niche + offer into consistent organic posts that soft-sell—so reach connects to the business.

---

## User Flow (4 steps)

1. **Create project** — Niche account + product/page to soft-sell
2. **Pick topic** — Organic angle lined up for the project
3. **Slides drafted** — Problem-first hook, value slides, soft product bridge
4. **Edit & export** — Tweak copy/photo, export PNGs for Instagram & TikTok

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
   - Hero: “Organic Instagram & TikTok carousels that market your product—without sounding like ads.”
   - CTA: “Start marketing with carousels”, “Sign in”
   - Hero carousel preview: organic problem → soft offer arc
   - “How it works” — niche + offer → generate → post to IG & TikTok
   - Features — organic product marketing, one project = one niche, swipe-ready export
   - Final CTA: ship more organic posts

2. **Carousel editor**
   - Slide grid (1080×1080 or 1080×1350 or 1080×1920)
   - Light edit for creators; export PNG/JPEG ZIP

3. **Output**
   - Instagram & TikTok-style carousel slides
   - Export sizes: 1080×1080, 1080×1350, 1080×1920

---

## Marketing Angles for Promo Video

- Marketing tool, not a design studio
- Organic product soft-sell on IG & TikTok
- Niche + offer → problem-first carousels
- Templates locked; focus on message and photos
- Export PNGs and post
- Mobile-friendly (add to home screen)

---

## Technical Stack (for context)

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (Auth, DB, Storage)
- AI slide generation, Playwright for export
- Stock / web / library images (not AI layout design)
