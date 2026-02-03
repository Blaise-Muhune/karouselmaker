# Carousel generation

How the AI carousel generator works: schema, project rules, retries, and input types.

## JSON schema contract

The AI must return **strict JSON** (no markdown, no code fences) in this shape:

```json
{
  "title": "string",
  "slides": [
    {
      "slide_index": 1,
      "slide_type": "hook|point|context|cta|generic",
      "headline": "string (short)",
      "body": "string (optional, short)"
    }
  ],
  "caption_variants": {
    "short": "string",
    "medium": "string",
    "spicy": "string"
  },
  "hashtags": ["string", "..."]
}
```

- **slide_index**: Starts at 1, increments by 1.
- **slide_type**: Exactly one of `hook`, `point`, `context`, `cta`, `generic`. If `number_of_slides` ≥ 6, the last slide must be `cta`.
- **headline**: Max 120 chars; readable in ~2 seconds.
- **body**: Optional, max 300 chars per slide.
- **caption_variants**: Short / medium / spicy caption options for the post.
- **hashtags**: Array of strings, max 15, no `#` prefix in the schema (UI may add it).

Validation is done with Zod in `lib/server/ai/carouselSchema.ts`. Invalid output is never saved.

## How project rules influence output

- **tone_preset** (neutral, funny, serious, savage, inspirational) is passed into the system prompt so the model matches the project voice.
- **voice_rules.do_rules** and **voice_rules.dont_rules** are injected into the system prompt as “Do: …” and “Don’t: …”.
- **slide_structure.number_of_slides** sets how many slides to generate and enforces a final CTA when ≥ 6.

The prompt is built in `lib/server/ai/prompts.ts` from the current project and input.

## Retry and validation

1. Generate once with the main prompt.
2. Parse response (strip markdown/code fences if present) and validate with the Zod schema.
3. On validation failure: retry up to **2 times** with a correction prompt that includes the raw output and the validation errors.
4. If still invalid after retries: leave the carousel in `draft` and return an error; no invalid slides are written.

Only validated output is used to update the carousel (title, status, caption_variants, hashtags) and to replace slides.

## Input types

| Type   | Description |
|--------|-------------|
| **topic** | Short topic or idea (e.g. “5 habits of successful creators”). Model generates a full script from it. |
| **url**   | URL is passed as context. URL fetching is not implemented yet; the model is told to treat it as topic text and not to hallucinate quotes or page content. |
| **text**  | Pasted long-form text. Model summarizes and turns it into a slide script (Pubity-style, short and punchy). |

Input is sent in the user prompt; the system prompt defines tone, rules, and the exact JSON format.
