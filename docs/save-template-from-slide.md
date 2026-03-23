# Save template from slide edit — what is saved and what is not

When you use **Save as template** in the slide editor, the following applies.

---

## What **is** saved into the template

### From the current template (base)
- **Layout** — e.g. `headline_bottom`, `headline_center`, `split_top_bottom`, `headline_only`
- **Safe area** — top/right/bottom/left padding
- **Text zones** — headline and body zone definitions (x, y, w, h, fontSize, fontWeight, lineHeight, maxLines, align, optional color)
- **Overlays** — gradient (see below) and vignette settings from the base template
- **Chrome** — swipe hint, counter style, watermark position (and see below for toggles)
- **Background rules** — allowImage, defaultStyle (darken/blur/none)

### From the current slide (overlay / chrome)
- **Gradient overlay** — taken from the slide’s background overlay:
  - enabled, direction, strength (darken), extent, color, solidSize
- **Chrome toggles** — show counter, show watermark (from the slide’s current state)
- **Chrome colors** — swipe color, counter (slide number) color, logo/watermark color — saved in template `chrome` and in `defaults.meta` (swipe_color, counter_color, watermark_zone_override.color) so they apply when the template is used
- **Watermark** — same position/config as base template, with `enabled` set from the slide’s “show watermark”, and watermark color when set

### Defaults (preset applied when using this template)
- **Background** — when the slide uses **solid/gradient** (no photo): `style`, `color`, `gradientOn`, `overlay`, etc.
- **Background images** — when the slide uses **image mode** (including **multiple slots** for shuffle or **PiP**), the template stores `defaults.background` with `mode: "image"` and `images: [{ image_url, alternates, … }, …]` (or legacy single `image_url`). Used for **template picker / list previews** and applied when you **choose this template** on a slide so the saved layout matches. Remote URLs only (signed URLs are stripped at save).
- **Meta** (applied to slides when they use this template):
  - `show_counter`, `show_watermark`, `show_made_with`
  - `headline_font_size`, `body_font_size` (if set)
  - **Headline zone override** — x, y, w, h, fontSize, fontWeight, lineHeight, maxLines, align (if you changed “Edit position” for headline)
  - **Body zone override** — same for body (if you changed “Edit position” for body)
  - `headline_highlight_style`, `body_highlight_style` (text vs background)
  - **Headline highlights** — word-based spans (start, end, color) if you have any
  - **Body highlights** — same for body
  - **Image overlay blend** — tint opacity (0–1) and tint color (hex), applied when the slide uses a background image
  - **Background color** — hex color used as fill/fallback (and as tint color when no separate tint is set)

So: layout, text zone positions/sizes, gradient overlay, chrome toggles, image overlay blend, background color, and the “defaults” above (including zone overrides and highlight styling) **are** saved.

---

## What is **not** saved

- **Headline text** — the actual headline content is not stored in the template.
- **Body text** — the actual body content is not stored in the template.
- **Caption / hashtags** — not part of the template config.
- **Export format/size** — not part of the template (carousel-level).
- **Slide order or number of slides** — not relevant; the template is a single-slide design.

---

## After saving

- A **new template** is created with the name you entered (category inferred from slide type when applicable).
- The new template is **applied to the current slide** (and saved defaults include image backgrounds when present). Other slides are unchanged unless you use “Apply to all”.
