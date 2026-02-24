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
- **Watermark** — same position/config as base template, with `enabled` set from the slide’s “show watermark”

### Defaults (preset applied when using this template)
- **Background** — only when the slide background is **not** an image:
  - Solid/gradient: `style`, `color`, `gradientOn`, `overlay` (color, darken, direction, etc.)
- **Meta** (applied to slides when they use this template):
  - `show_counter`, `show_watermark`, `show_made_with`
  - `headline_font_size`, `body_font_size` (if set)
  - **Headline zone override** — x, y, w, h, fontSize, fontWeight, lineHeight, maxLines, align (if you changed “Edit position” for headline)
  - **Body zone override** — same for body (if you changed “Edit position” for body)
  - `headline_highlight_style`, `body_highlight_style` (text vs background)
  - **Headline highlights** — word-based spans (start, end, color) if you have any
  - **Body highlights** — same for body

So: layout, text zone positions/sizes, gradient overlay, chrome toggles, and the “defaults” above (including zone overrides and highlight styling) **are** saved.

---

## What is **not** saved

- **Headline text** — the actual headline content is not stored in the template.
- **Body text** — the actual body content is not stored in the template.
- **Background images** — if the slide uses an image (or multiple images), that background is **not** saved. Only non-image backgrounds (solid/gradient) are stored in `defaults.background`.
- **Caption / hashtags** — not part of the template config.
- **Export format/size** — not part of the template (carousel-level).
- **Slide order or number of slides** — not relevant; the template is a single-slide design.

---

## After saving

- A **new template** is created with the name you entered (category `generic`).
- The new template is **applied to all slides** in the current carousel, and the saved **defaults** (background when non-image, and meta such as counter/watermark, font sizes, zone overrides, highlight styles/highlights) are applied to every slide so layout and styling stay consistent.
