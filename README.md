# Karouselmaker

Marketing tool for organic Instagram & TikTok carousels that promote your product—without sounding like ads. Generate short swipe posts (3–7 slides) one at a time, tuned to a project’s niche and offer — with stock photos, Brave web images, or your own uploads / Google Drive.

## Flow

**Project** (niche + product to promote) → **Generate one organic post** → **Light edit** → **Export PNG/JPEG ZIP** → post on IG/TikTok.

Generation remembers recent posts in the project so angles don’t repeat.

## Stack

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (Auth + DB + Storage)
- Stripe billing
- pnpm

## Develop

```bash
pnpm install
pnpm dev
```

See `docs/` for generation, export, templates, and env setup.

## Agent priorities

See [AGENTS.md](AGENTS.md).
