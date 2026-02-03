# Projects

Project model, fields, and how they affect carousel generation.

## Project fields

| Field | Purpose |
|-------|---------|
| **name** | Display name; unique per user. |
| **niche** | Optional topic/vertical (e.g. Marketing, Fitness). Used later to scope AI context. |
| **tone_preset** | Default voice: `neutral`, `funny`, `serious`, `savage`, `inspirational`. |
| **voice_rules** | JSON: `do_rules`, `dont_rules` (text). Do/don’t instructions and banned phrases for generation. |
| **slide_structure** | JSON: e.g. `number_of_slides`, later `pattern` (hook/point/cta layout). |
| **brand_kit** | JSON: `primary_color`, `secondary_color`, `watermark_text`. Used by renderer for layout and export. |
| **sources** | JSON: reserved for allowed domains, RSS, etc. |

## Tone and voice rules

- **Tone preset** sets the default style for all slides in that project (casual, punchy, inspirational, etc.).
- **Voice rules** refine how the AI writes:
  - **Do rules**: e.g. “Use short sentences”, “Start with a question”, “Include a number in the headline”.
  - **Don’t rules**: e.g. “No jargon”, “Avoid passive voice”, “No banned words”.
- These are applied at generation time (see `lib/ai`) so the model output matches the project’s voice.

## Stored JSON

- **voice_rules**: `{ do_rules: string, dont_rules: string }`.
- **slide_structure**: `{ number_of_slides: number }` today; later can include `pattern` (slide types per index).
- **brand_kit**: `{ primary_color?, secondary_color?, watermark_text? }` — hex colors and optional watermark for the renderer.
