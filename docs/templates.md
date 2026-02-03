# Template system

Templates define how carousel slides look. They live in the database and control layout zones, safe margins, overlays, and typography. The renderer uses template config + slide text + brand kit to produce a consistent 1080×1080 preview.

## Why templates are locked

- **AI writes text only, not layouts.** The product rule is: AI generates headline and body copy; templates control where and how that text appears.
- **Predictable output.** Locked templates ensure every slide follows the same safe areas and readability rules. No AI-designed layouts that break on small screens or violate platform guidelines.
- **Creator control.** Users (or the app) choose a template per slide; the look is deterministic and consistent.

## Template config (JSON)

Stored in `templates.config` (JSONB). Validated with Zod on save and when building the render model.

### Shape

- **layout** — `headline_bottom` | `headline_center` | `split_top_bottom` | `headline_only`. Named layout type for semantics; actual positions come from `textZones`.
- **safeArea** — `{ top, right, bottom, left }` in pixels (1080×1080 space). Content stays inside these margins for IG-safe and readable output.
- **textZones** — Array of zones, each with:
  - `id` — `"headline"` or `"body"` (matched to slide headline/body).
  - `x, y, w, h` — Position and size in pixels.
  - `fontSize`, `fontWeight`, `lineHeight`, `maxLines`, `align` — Typography and cap.
- **overlays** — `gradient` (enabled, direction, strength), `vignette` (enabled, strength). Applied on top of background for readability.
- **chrome** — `showSwipe`, `showCounter`, `counterStyle` (e.g. `"1/8"`), `watermark` (enabled, position). SWIPE label, slide counter, and optional watermark text from project brand kit.
- **backgroundRules** — `allowImage`, `defaultStyle` (`darken` | `blur` | `none`). Used when a background image is present.

Validation: `lib/server/renderer/templateSchema.ts` (`templateConfigSchema`). Invalid configs are rejected on save; only valid configs are used in the renderer.

## Text fitting

- **fitTextToZone(text, zone)** (`lib/renderer/fitText.ts`) — Heuristic line wrapping: approximate chars per line from zone width and font size (~0.55× font size per character), then word-wrap up to `zone.maxLines`. No pixel-perfect measurement; goal is consistent, readable blocks that respect max lines and approximate width.
- The render model gets **lines** per zone; the preview component renders those lines with the zone’s `fontSize`, `fontWeight`, `lineHeight`, and `align`.

## Render model

- **buildSlideRenderModel(templateConfig, slideData, brandKit, slideIndex, totalSlides)** (`lib/renderer/renderModel.ts`) — Produces a `SlideRenderModel`:
  - Background (color, optional image URL, gradient on/off and strength).
  - Text blocks (zone + fitted lines).
  - Chrome: SWIPE, counter text (e.g. `"3/8"`), watermark text from brand kit.
- **applyTemplate** (`lib/renderer/applyTemplate.ts`) — Thin wrapper around `buildSlideRenderModel` for consistent naming.
- The **SlidePreview** component takes (slide, templateConfig, brandKit, totalSlides, optional background URL), builds the model (or uses a pre-built one), and renders HTML/CSS in a fixed 1080×1080 container (scaled with CSS in the editor grid).

## System templates

- **Definition:** Rows in `templates` with `user_id = NULL`. Available to all users; read-only in the UI.
- **Seeded in migration** `009_seed_system_templates.sql`: 5 templates —
  - **Headline bottom (hook)** — category `hook`, layout `headline_bottom`.
  - **Point clean** — category `point`, layout `headline_center`.
  - **Context block** — category `context`, layout `split_top_bottom`.
  - **CTA bold** — category `cta`, layout `headline_only`.
  - **Generic minimal** — category `generic`, layout `headline_bottom`.
- Categories are used for display and for future AI auto-pick (e.g. hook slide → hook template). No logic in the app currently assigns template by category; user (or future AI) selects template per slide.

## Editor behavior

- Carousel editor loads slides, project (brand kit), and templates (system + user, with parsed config).
- Each slide card shows a **SlidePreview** (1080×1080, scaled down) and a **template selector** (dropdown). If `slide.template_id` is null, the first available template is used for preview only until the user picks one.
- Changing the template calls **setSlideTemplate(slideId, templateId)** and revalidates the editor path so the grid refreshes with the new template.

## Templates manager

- **Route:** `/(app)/templates` — Lists system templates (read-only) and user templates (editable later). No “Create template” in this MVP-lite; only listing.
