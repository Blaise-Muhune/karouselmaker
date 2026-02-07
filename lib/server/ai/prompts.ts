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
  /** Project niche (e.g. productivity, fitness, marketing). Used to make CTA relevant and conversion-focused. */
  project_niche?: string;
  /** When true, model has web search—use it for URLs, recent info, time-sensitive topics. */
  use_web_search?: boolean;
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
- Headlines: max 120 chars, punchy. Body: default short (under 300 chars). Use up to 600 chars only when needed—e.g. quotes, full explanations, step-by-step, lists. Most slides stay brief.
- Minimal punctuation.
- NEVER include URLs, links, or web addresses in headline or body. Summarize the content in plain text only—no "read more at...", no "source:", no https:// or www. links.
- slide_index starts at 1 and increments.
- slide_type must be exactly one of: hook, point, context, cta, generic.
- The FIRST slide must ALWAYS be slide_type "hook"—an intro that hooks visually and textually. Punchy headline, compelling image. Never skip the hook.
- For list-style topics (top X, best X, ranking): hook first, then order content from least to best. E.g. "top 10 duos" → slide 1 = hook, slide 2 = #10, ..., last content = #1.
- If the carousel has 6+ slides, the last slide must be slide_type "cta".
- For the last slide (slide_type "cta"): the headline MUST be an innovative, high-converting follow call-to-action. Be creative—not generic "follow for more". Tie it to BOTH the carousel topic AND the project niche. Use urgency, exclusivity, or value. Examples: "You won't find us again—unless you follow @handle", "This is the last productivity tip you'll need → @handle", "We drop fitness breakdowns like this daily. @handle", "Follow @handle—we don't post this anywhere else", "Save this. Then follow @handle for more [topic]". Use creator_handle exactly if provided. Make it feel unique to the content and niche.
- Tone for this project: ${ctx.tone_preset}.
- Do NOT use **bold** or {{color}} formatting. Output plain text only. The user will add formatting when editing.
${ctx.do_rules ? `Do: ${ctx.do_rules}` : ""}
${ctx.dont_rules ? `Don't: ${ctx.dont_rules}` : ""}

${ctx.use_ai_backgrounds ? `- For EVERY slide add unsplash_queries (array). DEFAULT: 1 IMAGE per slide. Use unsplash_queries with ONE string only unless the slide truly needs 2.
  • 1 IMAGE: almost always. One query string, e.g. unsplash_queries: ["nature landscape peaceful"] or ["Lionel Messi 4k"].
  • 2 IMAGES: only when the slide explicitly compares or contrasts two distinct things—e.g. "Player A vs Player B", "before vs after", "option 1 vs option 2". Then use 2 queries: ["Player A 4k", "Player B 4k"]. Do NOT use 2 images for single-concept slides.
  • GENERIC slides (quotes, verses, motivation): one nature/landscape query—e.g. "peaceful nature landscape", "mountain sunrise", "calm ocean".
  • SPECIFIC slides (celebrities, sports): one concrete query—e.g. "Lionel Messi 4k". For shared context (teammates, same movie): one query like "Neymar and Messi Barcelona". Add "4k" or "high quality" for specific queries.
  • CTA slides: use a topic-related image that fits the carousel's subject and project niche—e.g. "productivity workspace", "fitness motivation", "marketing strategy". Not generic landscape.` : ""}

Output format (JSON only). Plain text only—no ** or {{color}} formatting. Example: {"slide_index":1,"slide_type":"hook","headline":"One habit that changes everything","body":"Focus on one thing first. Simple."}
{"title":"string","slides":[{"slide_index":1,"slide_type":"hook|point|context|cta|generic","headline":"string","body":"string or omit"${ctx.use_ai_backgrounds ? ',"unsplash_queries":["phrase"]' : ""}}],"caption_variants":{"short":"string","medium":"string","spicy":"string"},"hashtags":["string"]}`;

  const urlNote =
    ctx.input_type === "url"
      ? ctx.use_web_search
        ? " Use web search to fetch and summarize the URL content. Create a carousel based on what you find. Do NOT include any URLs or links in the slide text—summarize in plain text only."
        : " Note: URL fetching is not implemented yet. Treat the URL as topic text; do not hallucinate quotes or content from the page. Do NOT include URLs or links in slide headline or body."
      : ctx.use_web_search
        ? " You have web search. Use it for time-sensitive topics (e.g. 2025 releases, recent events) to ensure accurate, current info."
        : "";

  const slideCountInstruction = ctx.number_of_slides != null
    ? `Generate a carousel with exactly ${ctx.number_of_slides} slides.`
    : `Generate a carousel. Decide the best number of slides based on the content. ALWAYS start with a hook slide (slide 1)—visually and textually engaging intro. For list-style topics (e.g. "top 20", "best X"): hook first, then distribute items from least to best—first content slide = lowest rank, last content slide = #1 (the top).`;

  const creatorHandleNote = ctx.creator_handle?.trim()
    ? `\nCreator handle for CTA slide (use exactly in last slide headline; make the CTA innovative and conversion-focused): ${ctx.creator_handle.trim()}`
    : "";

  const projectNicheNote = ctx.project_niche?.trim()
    ? `\nProject niche (weave into CTA—make the last slide feel specific to this niche): ${ctx.project_niche.trim()}`
    : "";

  const notesSection = ctx.notes?.trim()
    ? `\nOVERRIDE (priority over all rules above—follow these if they contradict anything): ${ctx.notes.trim()}`
    : "";

  const user = `${slideCountInstruction}
Input type: ${ctx.input_type}.
Input value:
${ctx.input_value}
${urlNote}${creatorHandleNote}${projectNicheNote}${notesSection}

${ctx.use_ai_backgrounds ? "CRITICAL: 1 IMAGE per slide unless comparing 2 things (e.g. vs, before/after). unsplash_queries: one string for most slides. Two strings ONLY when slide explicitly contrasts two subjects. For GENERIC: 'peaceful nature landscape', 'mountain sunrise'. For SPECIFIC: 'Lionel Messi 4k'. Add '4k' for specific queries." : ""}

${ctx.use_web_search ? "CRITICAL: After any web search, your response must be ONLY the raw JSON object. No markdown, no code fences, no text before or after. Start with { and end with }." : "Respond with valid JSON only."}`;

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
Use plain text only—no ** or {{color}} formatting.`;

  const user = `Your previous output:
${raw}

Validation errors:
${errors}

Respond with corrected JSON only. Plain text in headline and body. Remove any URLs or links from the content.`;

  return { system, user };
}
