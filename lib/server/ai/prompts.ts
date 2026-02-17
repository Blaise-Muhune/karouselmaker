/** ISO 639-1 code to display name for prompt instructions. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  ar: "Arabic",
  hi: "Hindi",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

type PromptContext = {
  tone_preset: string;
  do_rules: string;
  dont_rules: string;
  /** If set, generate exactly this many slides. If undefined, AI decides the best number. */
  number_of_slides: number | undefined;
  input_type: "topic" | "url" | "text";
  input_value: string;
  /** When true, AI should suggest image_queries (array) per slide—one per image (Brave or Unsplash). */
  use_ai_backgrounds?: boolean;
  /** When true and use_ai_backgrounds is true, images come from Unsplash only (simple queries). When false, images come from web/Brave search—use detailed, platform+quality queries. */
  use_unsplash_only?: boolean;
  /** Creator's @handle for CTA slide (e.g. @username). Used in last slide follow call-to-action. */
  creator_handle?: string;
  /** Project niche (e.g. productivity, fitness, marketing). Used to make CTA relevant and conversion-focused. */
  project_niche?: string;
  /** Project language (ISO 639-1, e.g. en, es). When not en, all carousel text must be in this language. */
  language?: string;
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
- NEVER ask a follow-up or ask the user to clarify. If the topic or URL is unclear, vague, or minimal, generate the best carousel you can—anchor it to the project niche and make it useful and shareable. Always output a full carousel (JSON only). No "Could you clarify?", "What do you mean?", or questions—just produce a good response that fits the niche.
- NEVER create slides whose content asks the reader to clarify, choose, or decide something. Forbidden: "Pick what X means", "Decide your metric first", "Is it A or B?", "Choose your definition", "First you need to...", or any slide that defers the answer to the reader. The carousel must deliver the actual answer or content—not a meta-guide or a list of options for the reader to pick from. If the topic is ambiguous (e.g. "perfectly rated episodes", "best results"), make a reasonable assumption (e.g. assume widely used metrics like IMDb-style ratings or critic consensus) and generate concrete content (e.g. actual examples, a clear definition you chose, or a ranked list). Never fill slides with instructions like "search episode-level lists" or "cross-check critics"—give the substance instead.
- ACCURACY & VALUE: Be accurate—do not invent facts, stats, names, or quotes. Use web search when available for topics that need current or verifiable data. If you are uncertain about a specific claim (e.g. a number, a ranking, a date), either omit it or phrase it in a way that does not present guesswork as fact. When you produce rankings or "top X" lists, base them on real criteria (e.g. actual ratings, awards, widely cited lists, consensus) rather than making up an arbitrary order. Prioritize valuable, useful information: actionable tips, real examples, correct explanations. No random or filler content—every slide should add substance the reader can trust.
- Short lines. No filler. No complex sentences.
- Headlines: max 120 chars, punchy. Body: default short (under 300 chars). Use up to 600 chars only when needed—e.g. quotes, full explanations, step-by-step, lists. Most slides stay brief.
- Minimal punctuation.
- Sound human, not AI: use contractions (don't, it's, can't). Vary sentence length—mix short punchy lines with occasional longer ones. Use active voice. Avoid generic AI phrases: "dive into", "unlock", "transform", "harness", "game-changer", "cutting-edge", "seamlessly", "at the forefront", "in today's world", "elevate", "innovative solutions", "firstly/secondly/lastly", "it's important to note". Write like a real creator sharing tips—conversational, specific, not corporate buzzwords.
- NEVER include URLs, links, or web addresses in headline or body. No markdown links like [text](url) or (url). No "source:", "read more at", or citations. Summarize in plain text only—slide text must be link-free.
- slide_index starts at 1 and increments.
- slide_type must be exactly one of: hook, point, context, cta, generic.
- The FIRST slide must ALWAYS be slide_type "hook"—an intro that hooks visually and textually. Never skip the hook.
  • Hook headline: The headline of slide 1 (hook) MUST be exactly the carousel title—the same string as the top-level "title" field. Do NOT use a different hook line (e.g. "When God moved"); use the carousel title as the first slide's headline (e.g. "Greatest Miracle Moments in the Bible"). The hook body can be a short intro line; the headline must match the title.
  • Hook rules (body only): (1) NON-SPOILER—don't give away what the rest says. (2) ON-TOPIC—same vibe as the topic. (3) Keep body simple—short, one clear idea.
- After slide 1 (hook), go straight to the points. Slide 2 should start the actual content—no long intro or wind-up; get to the substance quickly.
- Use ranking or "top X" structure ONLY when the topic clearly asks for it (e.g. "top 10 duos", "best 5 apps", "ranking of X"). Then: hook first, then order from least to best (slide 2 = lowest rank, last content slide = #1). Rankings must be based on real criteria (ratings, awards, consensus, verifiable data)—do not invent or randomize the order. When numbering ranked items, pick ONE style and use it consistently for the whole carousel—e.g. all "1." or all "#1" or all "1)" or all "1/". Do NOT mix styles (no "1." on one slide and "#1" on another).
- For everything else—how-to, explain, why, tips, story, breakdown, general topic—do NOT force a ranked list. Expand on the topic in the best format: explanation, key points, steps, narrative, or a simple list without "top N" framing. Match the format to what the user asked for.
- NEWS / CURRENT EVENTS: When the topic is news or a recent event: (1) Use web search if available to get current, accurate facts—do not rely on memory for dates, names, or outcomes. (2) Stay factual and clear: lead with what happened or key takeaways; avoid speculation unless the angle is explicitly analysis or opinion. (3) Hook can be headline-style (what happened or why it matters)—keep it simple. (4) No "according to", "source:", or citations in slide text; summarize in plain text only. (5) For image_queries, use the actual subject of the story (person, place, event)—e.g. [person in the news] 3000x2000 photo, [event name] press—not generic "news" or "breaking" imagery.
- If the carousel has 6+ slides, the last slide must be slide_type "cta".
- For the last slide (slide_type "cta"): the headline MUST be an innovative, high-converting follow call-to-action. Be creative—not generic "follow for more". Lead with the PROJECT NICHE (this is the main focus of the CTA); mention the topic only lightly or in passing. Use urgency, exclusivity, or value. Examples: "You won't find us again—unless you follow @handle", "This is the last productivity tip you'll need → @handle", "We drop fitness breakdowns like this daily. @handle", "Follow @handle—we don't post this anywhere else", "Save this. Then follow @handle for more [niche]". Use creator_handle exactly if provided. Niche-first, topic second.
- Tone for this project: ${ctx.tone_preset}.
${ctx.language && ctx.language !== "en" ? `- LANGUAGE: Generate the ENTIRE carousel in ${LANGUAGE_NAMES[ctx.language] ?? ctx.language}. All title, headline, body, caption_variants, and hashtags MUST be written in ${LANGUAGE_NAMES[ctx.language] ?? ctx.language}. Do not mix languages.\n` : ""}- Do NOT use **bold** or {{color}} formatting. Output plain text only. The user will add formatting when editing.
- CAPTION VARIANTS (short, medium, spicy): Must NOT spoil the carousel. The reader should discover the content by swiping through the slides—not by reading the caption. Write captions that tease the topic, create curiosity, or set the vibe (like a hook). Do NOT list key points, conclusions, takeaways, or "you'll learn X, Y, Z". No summaries of what's inside. Short = one line tease. Medium = slightly longer tease or question. Spicy = same rule—intrigue only, no spoilers.
${ctx.do_rules ? `Do: ${ctx.do_rules}` : ""}
${ctx.dont_rules ? `Don't: ${ctx.dont_rules}` : ""}

${ctx.use_ai_backgrounds ? (ctx.use_unsplash_only
  ? `- CRITICAL: EVERY slide MUST have image_queries (array with at least 1 string). No exceptions. If you omit image_queries on any slide, images will not load.
  • HIGH QUALITY & RECOGNIZABLE (any topic): Prefer queries that are likely to return high-quality, recognizable imagery. Use specific subjects (named people, well-known figures, iconic places or things) rather than generic ones—e.g. for "why some stars look different for country vs club" use actual players or coaches (e.g. "Cristiano Ronaldo Portugal 4k", "Didier Deschamps France coach"), not "soccer player" or "football coach". Add quality cues like "4k", "high quality", or "3000x2000" where it fits. For non-ranking topics (explanatory, why, how-to), still anchor each slide to a concrete, recognizable subject from that world (athletes, coaches, celebrities, founders, etc.) so images feel specific and professional.
  • 1 IMAGE: almost always. One query string, e.g. image_queries: ["nature landscape peaceful"] or ["Kylian Mbappé 4k"].
  • 2 IMAGES: only when the slide explicitly compares or contrasts two distinct things—e.g. "Player A vs Player B", "before vs after". Then use 2 queries. Do NOT use 2 images for single-concept slides.
  • GENERIC slides (quotes, verses, motivation): one nature/landscape query—e.g. "peaceful nature landscape", "mountain sunrise", "calm ocean".
  • SPECIFIC slides (celebrities, sports): one concrete query with enough context to identify the person—e.g. "Mohamed Salah Liverpool 4k" or "Rodri Manchester City Spain footballer" (not just "Rodri"; add team/role/country so the right person is found). Add "4k" or "high quality" for specific queries. If unsure, use "nature landscape" or "abstract background".
  • FOOTBALL: "Football" can mean soccer or American football. Use context to decide: soccer (Premier League, FIFA, Ronaldo, Mbappé, World Cup, European leagues) → use "soccer" or "football soccer" in queries so images show the right sport; American football (NFL, Super Bowl, quarterback) → use "American football" or "NFL". Keep all image_queries consistent with the carousel—if the content is about soccer, every image must be soccer-related, not American football, and vice versa.
  • CTA slides: use a topic-related image—e.g. "productivity workspace", "fitness motivation". Not generic landscape.
  • Use simple, common search terms that return results. Avoid very niche or obscure phrases.`
  : `- CRITICAL: EVERY slide MUST have image_queries (array with at least 1 string). Images are fetched via Brave or Unsplash. Each image MUST be clearly related to the CAROUSEL TOPIC and to the slide—never generic.
  • HIGH QUALITY & RECOGNIZABLE (any topic): Always favor image_queries that are likely to return high-quality, recognizable results. Use specific subjects—named people (players, coaches, celebrities, experts), iconic places, well-known brands or events—not generic labels like "soccer player", "business person", or "actor". For non-ranking topics (e.g. "why some stars look different for country vs club", "how leaders make decisions"), still use concrete, recognizable figures (e.g. specific players or coaches for the football example; named CEOs or politicians for leadership). Add quality cues: 3000x2000, 4k, "high quality", or "official" where appropriate. For sports/athletes: do NOT use "press kit" or "kit"—they return jersey/uniform imagery; use "official photos", "3000x2000 photo", or "4k" instead. Generic or vague queries often return low-quality or irrelevant images; specific + quality cues yield recognizable, shareable imagery.
  • TOPIC-FIRST, NOT GENERIC: Anchor every query to the overall carousel topic. If the carousel is about "aura farming" or "looking effortless", do NOT use random stadiums, abstract gradients, minimal lines, or generic crowds. Use a person or thing that fits that world (e.g. style icon, content creator, someone known for that vibe). If the carousel is about "film and edit", the "film" slide must show filming/video editing/content creation—not unrelated imagery. Match the image subject to both the topic and the slide.
  • PREFER A PERSON RELEVANT TO THE TOPIC: When it fits, use a famous or recognizable person from that space—e.g. for style/presence use a known style or content creator; for film/editing use someone filming or an editing setup; for productivity use a known founder or workspace. Not generic stock; a real person or concrete thing tied to the topic.
  • WHEN THE SUBJECT IS A PERSON (especially by first name or common name): Add disambiguating details so the search returns the right person—e.g. full name, team, country, role, sport. Do NOT use only "rodri 3000x2000 photo" (many famous Rodris); use "rodri man city spain footballer 3000x2000 photo" or "rodri hernandez manchester city 3000x2000". Same for any athlete, celebrity, or public figure: include enough context (team, film, role, country) to guarantee the wanted result.
  • FOOTBALL (soccer vs American football): "Football" is ambiguous. Decide from the carousel content which sport is meant. Soccer (Premier League, FIFA, UEFA, World Cup, European/international context) → use "soccer" or "football soccer" in every image_query so images show the right sport (e.g. "Cristiano Ronaldo soccer 3000x2000", "soccer stadium celebration", "Premier League football 3000x2000"). American football (NFL, Super Bowl, quarterback, touchdown, US league) → use "American football" or "NFL" in queries (e.g. "NFL quarterback 3000x2000", "Super Bowl American football"). Keep all image_queries consistent—if the slides are about soccer, do not use American football imagery, and vice versa.
  • USE THESE BRAVE SEARCH PATTERNS (pick one per query; replace the subject with topic-relevant person/thing + disambiguating details for people):
  (1) Big dimensions: subject 3000x2000 photo, subject 2500x — e.g. [person full name or name + team/role/country] 3000x2000 photo.
  (2) Large file: subject filetype:jpg 3000, subject filetype:png 2500.
  (3) Official sites: subject site:pexels.com, subject site:commons.wikimedia.org, subject site:brandfolder.com (not for sports—see below), subject site:media.*.
  (4) Press/official: "official photos" subject. For non-sports only: "press kit" subject (for sports, "kit" returns jersey/uniform, not the person).
  (5) Full resolution: subject "full resolution" photo, subject "DSLR" photo.
  (6) Universal: subject 3000x2000 filetype:jpg. For non-sports: "press kit" images; for sports use "official photos" or dimensions/4k instead.
  • SPORTS (soccer, football, any athlete): Do NOT use "press kit" or "kit" in image_queries—search engines return sports kit (jersey, uniform) instead of the person. Use "official photos", "3000x2000 photo", "4k", "portrait", or "headshot" instead.
  • SLIDE 1 (hook): Use the MAIN SUBJECT of the carousel—the person, character, or figure that defines the topic. If the carousel is about a specific person, use that person. Do NOT use a generic object (e.g. Bible, book, landscape) when the topic centers on a specific person or character. CRITICAL for football/soccer: do NOT default to Lionel Messi for the first slide. Actively prefer other stars or coaches: Ronaldo, Mbappé, Salah, Haaland, Vinicius Jr, Bellingham, Neymar, or a coach (Guardiola, Klopp, Ancelotti, Deschamps). Pick someone who fits this carousel's angle or rotate—so first slides are varied across carousels, not always Messi.
  • LAST SLIDE (final image): Same variety rule. For football/soccer do NOT default to Messi. Use a different star or coach (Ronaldo, Mbappé, Salah, Haaland, etc.) so the last slide is not always the same person. For movies, music, business—rotate among several recognizable faces so first and last slides are not repetitive across carousels in a project.
  • COMIC BOOKS, FICTIONAL CHARACTERS, ANIME, SUPERHEROES: Do NOT use "press photo", "official photo", or "press kit" in image queries—there is no such thing for comics/characters. Use "official artwork" or "concept" instead (e.g. "Spider-Man official artwork 3000x2000", "Marvel character concept art"). Be intelligent about the topic: real people get press/photo style; fictional/comic get art style.
  • PAINTINGS, CLASSICAL ART, RELIGIOUS/HISTORICAL: Include "painting" (or "museum", "classical art") in the query ONLY when the topic is explicitly about paintings or art history. For general topics about religious figures, Bible stories, or historical people (e.g. Jesus, Moses, miracles), do NOT add "painting"—use "wallpaper", "images", "high resolution" so results include wallpapers, photos, and varied imagery, not only paintings. Avoid product-style queries (posters, Etsy); use "wallpaper" or "images free" to get usable art without limiting to paintings.
  • EVERY SLIDE: The query subject must be the topic or a topic-relevant person/thing—e.g. for a slide about "film, trim, post" use "video editing setup 3000x2000" or "content creator filming press kit"; for "calm face" use a person with calm expression in that topic context. No stadiums, abstract gradients, or decorative art unless the topic is literally about that.
  • NEWS / CURRENT EVENTS: For news topics, image_queries must use the actual subject of the story—e.g. [person in the news] 3000x2000 photo, [event name] press, [place] news conference. Not generic "breaking news" or "news broadcast"; use the real people, places, or events so images are on-topic and recognizable.
  • 2 IMAGES: only when the slide compares two distinct things; same pattern, both topic-relevant.`) : ""}

Output format (JSON only). Plain text only—no ** or {{color}} formatting. Example: {"slide_index":1,"slide_type":"hook","headline":"One habit that changes everything","body":"Focus on one thing first. Simple."}
{"title":"string","slides":[{"slide_index":1,"slide_type":"hook|point|context|cta|generic","headline":"string","body":"string or omit"${ctx.use_ai_backgrounds ? ',"image_queries":["phrase"]' : ""}}],"caption_variants":{"short":"string","medium":"string","spicy":"string"},"hashtags":["string"]}`;

  const urlNote =
    ctx.input_type === "url"
      ? ctx.use_web_search
        ? " Use web search to fetch and summarize the URL content. Create a carousel based on what you find. Do NOT include any URLs, markdown links [text](url), or source citations in headline or body—summarize in plain text only."
        : " Note: URL fetching is not implemented yet. Treat the URL as topic text; do not hallucinate quotes or content from the page. Do NOT include URLs or links in slide headline or body."
      : ctx.use_web_search
        ? " You have web search. Use it for time-sensitive topics (e.g. news, 2025 releases, recent events) to ensure accurate, current info. For news or current events: rely on web search for facts; keep slides factual and headline-style; no URLs or source citations—plain text only."
        : "";

  const slideCountInstruction = ctx.number_of_slides != null
    ? `Generate a carousel with exactly ${ctx.number_of_slides} slides.`
    : `Generate a carousel. Decide the best number of slides based on the content. ALWAYS start with a hook slide (slide 1). Only use a ranked list (hook, then least to best) when the input clearly asks for one (e.g. "top 10", "best 5", "ranking"). Otherwise expand on the topic in the best format—explanation, breakdown, steps, story, or key points—without forcing "top N" or ranking.`;

  const creatorHandleNote = ctx.creator_handle?.trim()
    ? `\nCreator handle for CTA slide (use exactly in last slide headline; make the CTA innovative and conversion-focused): ${ctx.creator_handle.trim()}`
    : "";

  const projectNicheNote = ctx.project_niche?.trim()
    ? `\nProject niche (weave into CTA—last slide should be mostly about this niche, only a little about the topic; if the input is unclear, generate a carousel that fits this niche): ${ctx.project_niche.trim()}`
    : "";

  const notesSection = ctx.notes?.trim()
    ? `\nOVERRIDE (priority over all rules above—follow these if they contradict anything): ${ctx.notes.trim()}`
    : "";

  const user = `${slideCountInstruction}
Input type: ${ctx.input_type}.
Input value:
${ctx.input_value}
If the topic is vague or ambiguous, assume a reasonable interpretation and deliver a full carousel with real content (examples, a clear take, or a ranked list). Do NOT output slides that ask the reader to "pick", "decide", or "choose" anything—give the answer. Keep all information accurate and valuable: no invented facts, stats, or random rankings—base rankings on real criteria and use web search when needed for verifiable topics.
${urlNote}${creatorHandleNote}${projectNicheNote}${notesSection}

${ctx.use_ai_backgrounds ? (ctx.use_unsplash_only
  ? "CRITICAL: Every slide MUST have image_queries with at least 1 string. Use simple, common search terms: 'peaceful nature landscape', 'mountain sunrise', 'calm ocean', 'productivity workspace', 'Kylian Mbappé 4k'. Avoid obscure or very niche phrases—they may return no images."
  : "CRITICAL: Every slide MUST have image_queries. Images must be about the CAROUSEL TOPIC and the slide—never generic. For any topic use specific, recognizable subjects (named people, well-known figures, iconic things) and quality cues (3000x2000, 4k, high quality, or \"official photos\"; for sports do NOT use \"press kit\" or \"kit\"—they return jersey/uniform) so results are high-quality and recognizable—especially for non-ranking topics like 'why X' or 'how Y', use actual players, coaches, celebrities, or experts, not generic labels. Prefer a person relevant to the topic. When the subject is a person (especially first name or common name), add disambiguating details: full name, team, country, role, or sport (e.g. rodri man city spain 3000x2000 photo, not just rodri 3000x2000). Use Brave patterns: subject + (1) 3000x2000 photo, (2) filetype:jpg 3000, (3) site or official photos, (4) \"official photos\" (for sports do NOT use \"press kit\" or \"kit\"—returns jersey/uniform), (5) \"full resolution\" or \"DSLR\" photo. For comic books, fictional characters, anime, superheroes: do NOT use press photo/official photo/press kit—use \"official artwork\" or \"concept art\" instead. For religious/historical figures and Bible topics (e.g. Jesus, Moses): use \"wallpaper\", \"images\" or \"high resolution\"—do NOT add \"painting\" unless the topic is explicitly about paintings or art. Only include \"painting\" when the user is researching art/paintings specifically. Avoid product-style queries (Etsy); prefer \"wallpapers\" or \"artwork\" for variety. Hook (slide 1): image must be the MAIN SUBJECT of the carousel (e.g. if about Jesus use Jesus, not the Bible; if about a person use that person). First slide = the face/figure that converts—no generic objects when the topic has a clear hero or character. For football/soccer: do NOT use Messi for slide 1 or last slide by default. Use Ronaldo, Mbappé, Salah, Haaland, Vinicius Jr, Bellingham, or a coach instead. Vary across carousels. After slide 1 go straight to the points—no wind-up. Last slide: same—for football do not default to Messi; use another star or coach. For movies/music: rotate among different actors/artists. Iconic, recognizable subject that fits the topic. Film/editing slides: filming or video editing imagery. News/current events: use the real subject of the story (person, event, place) for image_queries—e.g. [person] 3000x2000 photo, [event] press—not generic news imagery. No stadiums, abstract gradients, or random stock.") : ""}

${ctx.use_web_search ? "CRITICAL: After any web search, your response must be ONLY the raw JSON object. No markdown, no code fences, no text before or after. Start with { and end with }. Do NOT include any URLs or links (e.g. [site](url)) in headline or body—plain text only." : "Respond with valid JSON only."}`;

  return { system, user };
}

export function buildHookRewritePrompt(ctx: {
  tone_preset: string;
  do_rules: string;
  dont_rules: string;
  current_headline: string;
  /** Project language (ISO 639-1). When not en, all variants must be in this language. */
  language?: string;
}): { system: string; user: string } {
  const langName = ctx.language && ctx.language !== "en" ? LANGUAGE_NAMES[ctx.language] ?? ctx.language : null;
  const system = `You are a carousel hook writer. You output 5 alternative hook headlines that match the project style.
Output STRICT JSON only: an array of 5 strings. No markdown, no code fences, no explanation.

Rules:
- Short. Readable in 2 seconds.
- Minimal punctuation.
- No emojis unless the project allows.
- Sound human: use contractions, avoid AI phrases ("dive in", "unlock", "transform", "game-changer", "cutting-edge").
- Tone: ${ctx.tone_preset}.
${langName ? `- LANGUAGE: Write ALL 5 headlines in ${langName} only. Do not mix languages.\n` : ""}${ctx.do_rules ? `Do: ${ctx.do_rules}` : ""}
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
Use plain text only—no ** or {{color}} formatting. Sound human: contractions, no AI phrases (dive into, unlock, transform, game-changer).
CRITICAL: Preserve image_queries on every slide from the previous output. Do not remove them—only fix the validation errors.`;

  const user = `Your previous output:
${raw}

Validation errors:
${errors}

Respond with corrected JSON only. Plain text in headline and body. Remove any URLs or links from the content.`;

  return { system, user };
}
