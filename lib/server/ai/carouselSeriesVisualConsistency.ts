/**
 * One short "series bible" per carousel so AI-generated backgrounds stay visually coherent
 * (recurring character archetype when people fit the topic, palette, lighting, world).
 */

import OpenAI from "openai";

const MAX_OUT_CHARS = 620;

function parseConsistencyJson(raw: string): string | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as { series_consistency?: unknown };
    const s = parsed.series_consistency;
    if (typeof s !== "string") return null;
    const out = s.trim();
    if (out.length < 20) return null;
    return out.length > MAX_OUT_CHARS ? out.slice(0, MAX_OUT_CHARS - 1).trim() + "…" : out;
  } catch {
    return null;
  }
}

export function buildDeterministicUgcSeriesBriefForSave(params: {
  carouselTitle?: string;
  topic?: string;
  slideCount: number;
  seedCharacterBrief?: string;
}): string {
  return deterministicFallback({
    carouselTitle: params.carouselTitle,
    topic: params.topic,
    slideCount: params.slideCount,
    preferRecognizablePublicFigures: false,
    ugcMode: true,
    seedCharacterBrief: params.seedCharacterBrief,
  });
}

function deterministicFallback(params: {
  carouselTitle?: string;
  topic?: string;
  slideCount: number;
  preferRecognizablePublicFigures: boolean;
  ugcMode?: boolean;
  seedCharacterBrief?: string;
}): string {
  const anchor = (params.carouselTitle?.trim() || params.topic?.trim() || "this topic").slice(0, 120);
  const seed = params.seedCharacterBrief?.trim().slice(0, 280);
  const envLock =
    " **Same environment rule:** when several slides clearly share one place (same room, office, kitchen, gym, street, venue), keep architecture, wall/window treatment, furniture palette, time-of-day, and key light direction **consistent** across those slides until the story moves; do not randomize decor between slides in the same scene.";
  const castWardrobeLock =
    " **Same-day / same-outing cast rule:** when slide text implies one continuous timeline (same date, same morning, same trip, same party) with no explicit jump to a new day or wardrobe change, lock **per person** across those slides: same outfit colors and garment types, same hair (style/part/up-down), same jewelry and accessories, same dress code; if a partner or friend recurs, keep their look stable—do not swap a different companion each slide. Refresh only when copy clearly changes time or social context.";
  if (params.ugcMode && !params.preferRecognizablePublicFigures) {
    const seedBit = seed ? ` Locked to this recurring creator (preserve): ${seed}` : "";
    return `UGC / smartphone look across ${params.slideCount} slides for ${anchor}: default to **natural iPhone realism**—visible light sensor grain in medium indoor light, **often soft or imperfect focus** (not tack-sharp hero clarity every slide), **neutral white balance and muted colors**—**not** a series-wide orange/warm skin cast or golden-hour filter unless slides or style refs demand warmth; flat practical lighting (e.g. gym overheads, neutral LED, window daylight), realistic skin texture—**not** studio HDR, beauty retouch, catalog gloss, “perfect AI face,” or suspiciously convenient staging (plastic skin, empty designer sets, buttery HDR, perfectly framed “accidents”).${seedBit} **Camera**: interesting **phone-native** variety—rotate distance and framing (asymmetrical crop, slight tilt, foreground blur, over-shoulder at screen, top-down desk, doorway frame, reaction, environmental wide)—**not** the same centered medium every slide; still no crane, drone, glam hero, sunset silhouette, or synthetic blockbuster polish unless the topic demands it. Each slide matches the **story/emotional beat**; **when a moment would be weird to film** (split-second mishaps, spills), prefer **adjacent** believable posts (aftermath, car, home, with the other person)—not literal reenactments.${envLock}${castWardrobeLock} **Character lock** when a person appears: one recurring creator—identical face shape, features, hair (color/length/style/part), skin tone, body type, age read, recurring casual outfit palette, jewelry level, and stable recurring companions when the story keeps the same people; vary pose, expression, **framing**, and room. No text in images.`;
  }
  if (params.preferRecognizablePublicFigures) {
    return `Same documentary-style look across all ${params.slideCount} slides: consistent color grade and lighting family for ${anchor}. When a slide is about a specific public figure, keep that person’s era, kit, and setting believable and stable—do not invent random stand-ins.${envLock}${castWardrobeLock} No text in images.`;
  }
  return `One coherent visual world for ${anchor} across ${params.slideCount} slides: same overall color mood and photoreal (or same illustration style if stylized). If a recurring guide or character fits the topic, reuse one invented generic archetype (age range, hair, wardrobe, jewelry level)—not real celebrities. Vary camera angle and scene per slide, not a different random aesthetic each time.${envLock}${castWardrobeLock} No text in images.`;
}

/**
 * Build a single paragraph injected into every slide’s image prompt for series continuity.
 */
export async function buildCarouselSeriesVisualConsistency(params: {
  carouselTitle?: string;
  topic?: string;
  /** @deprecated Prefer slideContentLines for richer environment clustering. */
  slideHeadlines: string[];
  /** One line per slide: index, headline, short body—so same-room slides can be grouped. */
  slideContentLines?: string[];
  slideCount: number;
  preferRecognizablePublicFigures: boolean;
  /** UGC projects: iPhone-candid look + strict same-person continuity. */
  ugcMode?: boolean;
  /** Project-saved character paragraph to anchor the series lock. */
  seedCharacterBrief?: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return deterministicFallback(params);

  const linesFromContent =
    params.slideContentLines?.filter(Boolean).slice(0, 14) ?? null;
  const headlines = params.slideHeadlines
    .filter(Boolean)
    .slice(0, 12)
    .map((h, i) => `${i + 1}. ${h.slice(0, 140)}`)
    .join("\n");
  const slideBlock =
    linesFromContent && linesFromContent.length > 0
      ? linesFromContent.map((line) => line.slice(0, 300)).join("\n")
      : headlines || "(none)";

  const environmentClusterInstruction = `
ENVIRONMENT GROUPING (critical): Read each slide line. **Cluster slides that clearly happen in the SAME physical place** (e.g. same home kitchen, same office desk zone, same gym floor, same café corner, same stadium tunnel). For each cluster: lock **matching** details across those slides only—wall color/material, window shape/light, furniture style, floor, dominant props, time of day, and light direction (so images feel like returning to the same set). When a slide **moves** to a new location, start a new cluster and match within that new place for any following slides there. Slides about different worlds (e.g. cut from indoor to beach) should **not** force one room—only match within each implied environment.`;

  const sameTimelineCastInstruction = `
SAME-DAY / SAME-OUTING CAST (critical): Also cluster slides that read as **one continuous timeline**—same date night, same morning, same road trip, same event—when nothing in the text signals **next day**, **later that week**, **changed outfit**, or **different person**. For that cluster: name **fixed wardrobe anchors per recurring person** (garment colors/types, formality), **hair** (up/down, part, length read), **jewelry/accessories** (watch, earrings, necklace, glasses), and **any recurring partner or friends** (stable look; not a new actor each slide). When copy clearly jumps time or social context, you may start a fresh wardrobe/cast cluster.`;

  const ugcExtra = params.ugcMode && !params.preferRecognizablePublicFigures
    ? `
UGC / SMARTPHONE MODE (mandatory): **Default = real phone photo quality** unless project/carousel notes explicitly ask for studio, commercial, or cinematic lighting. Authentic iPhone-style candids: slight sensor noise in shadows, **soft or slightly missed focus** often OK—not every slide a crisp portrait—**default neutral / plain color** (no orange cast on every frame); warm, golden, or tungsten moods **only** when the slide setting or reference style clearly implies it—creators often grade in post. Believable light per location (indoors reads as indoors unless the slide clearly implies otherwise). **Reject AI-convenient looks**: no plastic skin, no hyper-symmetrical stock staging, no every-pixel-perfect HDR, no staged “perfect angle” for unlikely moments (accidents, spills)—prefer **nearby believable beats** (reaction, car, couch, with date, after the mess). Images should look like casual posts, not a crew filming every line. **Angles**: **engaging but phone-plausible**—vary shot type (over-shoulder, top-down, slight tilt, foreground blur, doorway, reaction, environmental wide); avoid one centered medium every slide; still **no** crane, drone, glam hero, floating product, or sunset-silhouette clichés. **Context-first**: match each slide’s **emotional/story beat**, not mandatory literal illustration of awkward micro-moments. **One recurring invented creator** when a person fits: strict continuity—same face, hair, skin tone, body, age read, casual wardrobe signature, jewelry level, and stable companions when the story keeps the same people; **same-day spans** must not randomize outfit or hair between slides unless text signals a change; change pose, expression, **framing**, and background—do not drift to a different person.
${params.seedCharacterBrief?.trim() ? `Project already has a saved character lock—preserve and align with: ${params.seedCharacterBrief.trim().slice(0, 400)}` : ""}`
    : "";

  const nf = params.preferRecognizablePublicFigures
    ? `NON-FICTION / REAL PEOPLE MODE: Slides may reference real public figures. Do NOT invent one recurring fictional "mascot" character. Instead: lock a consistent **documentary or editorial look** (lighting family, color grade, lens feel) and, when the same person appears on multiple slides, keep their portrayal consistent (era, outfit type, context). When each slide is about a different named person, that is fine—still keep the **same visual treatment** so the carousel feels like one series.`
    : `FICTION / EDUCATION / GENERIC TOPICS: If a recurring narrator, student, coach, or protagonist would help the topic, define **one invented generic archetype** (approx age, build, hair, clothing palette)—reuse across slides where a person appears. If the topic has no people, specify recurring **environment palette** (e.g. same office aesthetic, same outdoor region look) and prop motifs. Do not name real celebrities.`;

  const user = `Carousel title: ${params.carouselTitle?.trim() || "—"}
Creator topic/input: ${params.topic?.trim() || "—"}
Slide count: ${params.slideCount}

Per-slide text (headline + short body—use to spot same environment across slides):
${slideBlock}

${environmentClusterInstruction}
${sameTimelineCastInstruction}

${nf}
${ugcExtra}

Write series_consistency as ONE dense paragraph (max ~550 characters) the image model will see on every slide. MUST include: (1) which slide ranges share the same environment and what stays fixed there; (2) character continuity if people recur; (3) for any **same-day / same-outing** span, fixed wardrobe/hair/jewelry and stable recurring companions; (4) overall color/lighting style; (5) when scene or wardrobe/cast changes are allowed. No bullet characters in the string.`;

  const openai = new OpenAI({ apiKey });
  try {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_SERIES_CONSISTENCY_MODEL?.trim() || "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You help AI image generators stay consistent across a multi-slide carousel. Reply with ONLY JSON: {"series_consistency":"..."}.
The string is instructions for the image model—plain text inside JSON, no markdown, minimize newlines inside the string.
Prioritize: (A) **Same-environment locks**—group slides that occur in one place; name fixed set details (walls, windows, furniture, light direction, time) for each group. (B) Character continuity when the same invented person appears. (C) **Same-day / same-outing** spans: lock outfit, hair, jewelry, and recurring companions per person until text signals a time or social change. (D) Global palette/lighting. Be specific enough that each slide’s image can obey both the slide content AND the shared room and wardrobe rules when applicable.`,
        },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseConsistencyJson(raw);
    if (parsed) return parsed;
  } catch (e) {
    console.warn("[carouselSeriesVisualConsistency]", e instanceof Error ? e.message : e);
  }
  return deterministicFallback({
    carouselTitle: params.carouselTitle,
    topic: params.topic,
    slideCount: params.slideCount,
    preferRecognizablePublicFigures: params.preferRecognizablePublicFigures,
    ugcMode: params.ugcMode,
    seedCharacterBrief: params.seedCharacterBrief,
  });
}
