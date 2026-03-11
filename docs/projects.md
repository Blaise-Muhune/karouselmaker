# Projects

Project model, fields, and how they affect carousel generation.

## Project fields

| Field | Purpose |
|-------|---------|
| **name** | Display name; unique per user. |
| **niche** | Optional topic/vertical (e.g. Marketing, Fitness). Used later to scope AI context. |
| **tone_preset** | Default voice: `neutral`, `funny`, `serious`, `savage`, `inspirational`. |
| **project_rules** | JSON: `rules` (string). Optional rules/context for carousel text, AI image style, tone, banned words, etc. |
| **slide_structure** | JSON: e.g. `number_of_slides`, later `pattern` (hook/point/cta layout). |
| **brand_kit** | JSON: `primary_color`, `secondary_color`, `watermark_text`. Used by renderer for layout and export. |
| **sources** | JSON: reserved for allowed domains, RSS, etc. |

## Tone and rules

- **Tone preset** sets the default style for all slides in that project (casual, punchy, inspirational, etc.).
- **Rules or context** (`project_rules.rules`): a single free-form field for how you want carousel text written, how AI-generated images should look, tone, banned words, etc. Applied at generation time (carousel and hook rewrite).

## Stored JSON

- **project_rules**: `{ rules: string }`.
- **slide_structure**: `{ number_of_slides: number }` today; later can include `pattern` (slide types per index).
- **brand_kit**: `{ primary_color?, secondary_color?, watermark_text? }` — hex colors and optional watermark for the renderer.
