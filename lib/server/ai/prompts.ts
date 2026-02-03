type PromptContext = {
  tone_preset: string;
  do_rules: string;
  dont_rules: string;
  /** If set, generate exactly this many slides. If undefined, AI decides the best number. */
  number_of_slides: number | undefined;
  input_type: "topic" | "url" | "text";
  input_value: string;
  /** When true, AI should suggest unsplash_queries (array) per slide—one per image. */
  use_ai_backgrounds?: boolean;
  /** Creator's @handle for CTA slide (e.g. @username). Used in last slide follow call-to-action. */
  creator_handle?: string;
  /** Optional notes/context for the AI (e.g. "focus on beginners", "avoid jargon"). */
  notes?: string;
};

export function buildCarouselPrompts(ctx: PromptContext): {
  system: string;
  user: string;
} {
  const system = `You are a carousel script writer. You output Pubity-style slide scripts: short, bold, readable in under 2 seconds per slide.
Output STRICT JSON only. No markdown, no code fences, no explanation.

Rules:
- Short lines. No filler. No complex sentences.
- Headlines: max 120 chars, punchy. Body: max 300 chars per slide, optional.
- Minimal punctuation.
- slide_index starts at 1 and increments.
- slide_type must be exactly one of: hook, point, context, cta, generic.
- The FIRST slide must ALWAYS be slide_type "hook"—an intro that hooks visually and textually. Punchy headline, compelling image. Never skip the hook.
- For list-style topics (top X, best X, ranking): hook first, then order content from least to best. E.g. "top 10 duos" → slide 1 = hook, slide 2 = #10, ..., last content = #1.
- If the carousel has 6+ slides, the last slide must be slide_type "cta".
- For the last slide (slide_type "cta"): the headline MUST be a compelling, clickbait follow call-to-action using the creator's handle. Make it topic-relevant and engaging—don't just say "follow for more". Examples: "Follow @handle for more **productivity** tips", "Get the **full** guide → @handle", "**Follow** @handle for more like this". Use the provided creator_handle exactly. If creator_handle is provided, it must appear in the CTA headline.
- Tone for this project: ${ctx.tone_preset}.
- FORMATTING (required): Every slide MUST include at least one formatted word so it stands out.
  • Bold: use exactly ** (two asterisks), not ***. Wrap the word: **like this** → e.g. "**One** habit changes everything".
  • Color highlight: wrap the word in {{color}}word{{/}} → e.g. {{yellow}}game-changer{{/}} or {{lime}}simple{{/}}. Presets: yellow, amber, orange, lime, green, cyan, sky, pink, rose, white.
  Use bold and/or color in the headline and/or body. Prefer one strong word per line (e.g. **this** or {{yellow}}this{{/}}). Never leave headline or body without at least one formatted word per slide. Every headline and every body string must contain at least one **word** or {{color}}word{{/}}.
${ctx.do_rules ? `Do: ${ctx.do_rules}` : ""}
${ctx.dont_rules ? `Don't: ${ctx.dont_rules}` : ""}

${ctx.use_ai_backgrounds ? `- For EVERY slide add unsplash_queries (array). DEFAULT: 1 IMAGE per slide. Use unsplash_queries with ONE string only unless the slide truly needs 2.
  • 1 IMAGE: almost always. One query string, e.g. unsplash_queries: ["nature landscape peaceful"] or ["Lionel Messi 4k"].
  • 2 IMAGES: only when the slide explicitly compares or contrasts two distinct things—e.g. "Player A vs Player B", "before vs after", "option 1 vs option 2". Then use 2 queries: ["Player A 4k", "Player B 4k"]. Do NOT use 2 images for single-concept slides.
  • GENERIC slides (quotes, verses, motivation): one nature/landscape query—e.g. "peaceful nature landscape", "mountain sunrise", "calm ocean".
  • SPECIFIC slides (celebrities, sports): one concrete query—e.g. "Lionel Messi 4k". For shared context (teammates, same movie): one query like "Neymar and Messi Barcelona". Add "4k" or "high quality" for specific queries.` : ""}

Output format (JSON only). Bold = **word** (exactly two asterisks, never ***). Color = {{yellow}}word{{/}}. Example: {"slide_index":1,"slide_type":"hook","headline":"**One** habit that {{lime}}changes{{/}} everything","body":"Focus on **one** thing first. {{amber}}Simple.{{/}}"}
{"title":"string","slides":[{"slide_index":1,"slide_type":"hook|point|context|cta|generic","headline":"string with **bold** or {{color}}highlight{{/}}","body":"string with formatting or omit"${ctx.use_ai_backgrounds ? ',"unsplash_queries":["phrase"]' : ""}}],"caption_variants":{"short":"string","medium":"string","spicy":"string"},"hashtags":["string"]}`;

  const urlNote =
    ctx.input_type === "url"
      ? " Note: URL fetching is not implemented yet. Treat the URL as topic text; do not hallucinate quotes or content from the page."
      : "";

  const slideCountInstruction = ctx.number_of_slides != null
    ? `Generate a carousel with exactly ${ctx.number_of_slides} slides.`
    : `Generate a carousel. Decide the best number of slides based on the content. ALWAYS start with a hook slide (slide 1)—visually and textually engaging intro. For list-style topics (e.g. "top 20", "best X"): hook first, then distribute items from least to best—first content slide = lowest rank, last content slide = #1 (the top).`;

  const creatorHandleNote = ctx.creator_handle?.trim()
    ? `\nCreator handle for CTA slide (use exactly in last slide headline; make the CTA clickbait and topic-relevant, not just "follow for more"): ${ctx.creator_handle.trim()}`
    : "";

  const notesSection = ctx.notes?.trim()
    ? `\nAdditional context / things to know before generating: ${ctx.notes.trim()}`
    : "";

  const user = `${slideCountInstruction}
Input type: ${ctx.input_type}.
Input value:
${ctx.input_value}
${urlNote}${creatorHandleNote}${notesSection}

Required: In every slide, put at least one word in **bold** or in a color like {{yellow}}word{{/}} (or lime, orange, cyan, pink, etc.) in the headline and/or body. Every headline and body must contain at least one **bold** or {{color}}highlight{{/}}. Example headline: "**One** habit that {{lime}}changes{{/}} everything". Example body: "Focus on **one** thing first. {{amber}}Simple.{{/}}"
${ctx.use_ai_backgrounds ? "CRITICAL: 1 IMAGE per slide unless comparing 2 things (e.g. vs, before/after). unsplash_queries: one string for most slides. Two strings ONLY when slide explicitly contrasts two subjects. For GENERIC: 'peaceful nature landscape', 'mountain sunrise'. For SPECIFIC: 'Lionel Messi 4k'. Add '4k' for specific queries." : ""}

Respond with valid JSON only.`;

  return { system, user };
}

export function buildHookRewritePrompt(ctx: {
  tone_preset: string;
  do_rules: string;
  dont_rules: string;
  current_headline: string;
}): { system: string; user: string } {
  const system = `You are a carousel hook writer. You output 5 alternative hook headlines that match the project style.
Output STRICT JSON only: an array of 5 strings. No markdown, no code fences, no explanation.

Rules:
- Short. Readable in 2 seconds.
- Minimal punctuation.
- No emojis unless the project allows.
- Tone: ${ctx.tone_preset}.
${ctx.do_rules ? `Do: ${ctx.do_rules}` : ""}
${ctx.dont_rules ? `Don't: ${ctx.dont_rules}` : ""}

Output format: {"variants":["headline1","headline2","headline3","headline4","headline5"]}`;

  const user = `Current hook headline:
${ctx.current_headline}

Generate 5 alternative hook headlines (JSON array of 5 strings only).`;

  return { system, user };
}

export function buildValidationRetryPrompt(
  raw: string,
  errors: string
): { system: string; user: string } {
  const system = `You are a carousel script writer. You must output STRICT JSON that validates against this schema.
Previous attempt had validation errors. Fix them and output valid JSON only. No markdown, no explanation.
Keep **bold** and {{color}}word{{/}} formatting in headline and body (e.g. {{yellow}}, {{lime}}, {{orange}}).`;

  const user = `Your previous output:
${raw}

Validation errors:
${errors}

Respond with corrected JSON only. Preserve ** (two asterisks for bold, never ***) and {{ }} formatting in headline and body.`;

  return { system, user };
}
