# Quick Editor

The carousel editor lets creators refine slides before export: edit copy, reorder, shorten to fit, rewrite hooks, swap templates, and set background. All flows are minimal-click and deterministic where possible.

## Slide modal (click a slide)

- **Open:** Click a slide preview or the Edit (pencil) button on a slide card.
- **Fields:** Headline (textarea), body (optional), template picker, background (solid/gradient, color, overlay gradient on/off).
- **Preview:** Scaled 1080×1080 preview updates as you edit.
- **Actions:**
  - **Save** — Persists headline, body, template_id, and background to the slide. Revalidates the editor so the grid refreshes.
  - **Cancel** — Closes without saving.
  - **Shorten to fit** — Deterministic shortening (see below).
  - **Rewrite hook** — Only for slides with `slide_type === "hook"`. Calls AI to generate 5 alternative hook headlines; user picks one in the modal, then Save to persist.

Background is stored in `slides.background` (JSONB): `{ style?, color?, gradientOn? }`. The renderer uses it to override template default background and overlay in the preview.

## Reorder slides (drag and drop)

- **UI:** Each slide card has a grip handle (⋮⋮). Drag the grip (or the card) and drop on another card to reorder.
- **Persistence:** On drop, the client computes the new order and calls `reorderSlides(carousel_id, ordered_slide_ids, editorPath)`. The server verifies carousel ownership and updates `slide_index` for each slide in sequence. Then revalidate so the page refetches and counters (e.g. 1/8) update correctly.
- **Implementation:** Native HTML5 drag-and-drop (no extra dependency). No heavy drag library.

## Shorten to fit

- **Goal:** Trim headline and body so they fit within the template’s text zones (max lines and width) without AI.
- **Behavior:**
  1. Load slide and its template config.
  2. For headline zone: `shortenTextToZone(slide.headline, headlineZone)` → joined fitted lines.
  3. For body zone: same with `slide.body ?? ""`.
  4. Save updated headline and body to the slide.
- **Logic:** `fitTextToZone` returns lines that fit the zone (word-wrap, max lines). `shortenTextToZone` joins those lines into one string. So we effectively truncate to what fits; no filler removal or semantic shortening. Deterministic and fast.

## Hook rewrite (AI, controlled)

- **When:** Only for slides with `slide_type === "hook"`. Button “Rewrite hook” in the slide modal.
- **Inputs:** `slide_id`, `variant_count` (default 5).
- **Flow:**
  1. Load slide and parent carousel → project (tone_preset, voice_rules).
  2. Call OpenAI with `buildHookRewritePrompt({ tone_preset, do_rules, dont_rules, current_headline })`.
  3. Parse AI response as `{ variants: string[] }` (array of 5 hook headlines).
  4. Return variants to the client; **do not** save automatically.
  5. User picks one variant in the modal; that sets local headline state; user clicks Save to persist.
- **Prompt rules (see `lib/server/ai/prompts.ts`):**
  - Short. Readable in 2 seconds.
  - Minimal punctuation.
  - No emojis unless the project allows.
  - Tone and do/don’t rules from the project.
- **Validation:** AI output validated as JSON object with key `variants` and value array of strings (Zod: non-empty strings, max length 300).

## Caption and hashtags edit

- **UI:** “Edit caption” on the caption card opens a modal with Short / Medium / Spicy caption variants and a hashtags field (space- or comma-separated).
- **Persistence:** `updateCaption({ carousel_id, caption_variants?, hashtags? }, editorPath)`. Updates `carousels.caption_variants` (JSONB) and `carousels.hashtags` (text[]). Revalidates the editor path.

## Top actions (editor page)

- **Edit caption** — Opens caption/hashtags modal (above).
- **Export** — Disabled until export flow is implemented (Step 7).

## Server actions summary

| Action            | Inputs                          | Behavior |
|-------------------|----------------------------------|----------|
| updateSlide       | slide_id, headline?, body?, template_id?, background? | Zod-validate, ownership via carousel, update slide |
| shortenToFit      | slide_id                        | Load slide + template, shorten headline/body to zones, save |
| rewriteHook       | slide_id, variant_count?         | Load project tone/voice, call AI, return variants (no save) |
| reorderSlides     | carousel_id, ordered_slide_ids[] | Verify ownership, set slide_index for each slide, revalidate |
| updateCaption     | carousel_id, caption_variants?, hashtags? | Update carousel caption_variants and hashtags |

All actions that mutate data accept an optional `revalidatePathname` and call `revalidatePath` so the editor page refreshes after save.
