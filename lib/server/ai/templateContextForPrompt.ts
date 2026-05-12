import type { Json } from "@/lib/server/db/types";
import {
  getHeadlineBodyMaxCharsFromTemplateConfig,
  getTextZonesFromTemplateConfig,
  maxCharsForExtraTextZone,
  placementBandsForTextZone,
  visualLinesForZone,
} from "@/lib/templates/zoneCharBudget";

export { ABSOLUTE_MAX_BODY_CHARS, ABSOLUTE_MAX_HEADLINE_CHARS } from "@/lib/templates/zoneCharBudget";

export type TemplateContextForPrompt = {
  hasHeadline: boolean;
  hasBody: boolean;
  headlineMaxChars: number;
  bodyMaxChars: number;
  extraZoneIds: string[];
  /** Human-readable line for the system prompt. */
  promptSection: string;
};

const DEFAULT_FALLBACK_HEADLINE = 120;
const DEFAULT_FALLBACK_BODY = 600;

/**
 * Build template context for the carousel generation prompt so the AI knows
 * zone dimensions, font size, max lines, and whether headline/body exist.
 * Some templates have no body, or very small zones—this ensures we generate
 * the right amount of text.
 */
export function buildTemplateContextForPrompt(templateConfig: Json | null | undefined): TemplateContextForPrompt | null {
  const zones = getTextZonesFromTemplateConfig(templateConfig);
  if (zones.length === 0) {
    return {
      hasHeadline: true,
      hasBody: true,
      headlineMaxChars: DEFAULT_FALLBACK_HEADLINE,
      bodyMaxChars: DEFAULT_FALLBACK_BODY,
      extraZoneIds: [],
      promptSection: "",
    };
  }

  const m = getHeadlineBodyMaxCharsFromTemplateConfig(templateConfig);
  const extraZones = zones.filter((z) => z.id !== "headline" && z.id !== "body");

  const headlineMaxChars = m.headlineMaxChars;
  const bodyMaxChars = m.bodyMaxChars;
  const headlineVisualLines = m.headlineVisualLines;
  const bodyVisualLines = m.bodyVisualLines;

  const lines: string[] = [];
  lines.push("TEMPLATE TEXT LIMITS (strict—never exceed; text must fit the visible container):");
  if (m.hasHeadline) {
    if (headlineMaxChars <= 12)
      lines.push("- Headline zone: tiny. Use one to four words only; a single word is fine. Do not exceed ~12 characters.");
    else if (headlineMaxChars <= 25)
      lines.push(`- Headline zone: very small (~${headlineMaxChars} chars max). One short phrase or a few words; one word is OK.`);
    else if (headlineMaxChars <= 45)
      lines.push(`- Headline zone: small (~${headlineMaxChars} chars). One short line; prefer fewer characters.`);
    else if (headlineMaxChars >= 85)
      lines.push(
        `- Headline zone: **large capacity** (~${headlineMaxChars} chars). Use most of this budget: a **full, specific** headline—concrete detail, strong claim, or two short thoughts (use a single line break inside headline only if the template clearly supports multi-line headline). **Do not** leave a huge zone looking like a tiny billboard; match the layout scale.`
      );
    else
      lines.push(`- Headline zone: max ~${headlineMaxChars} characters. Stay within this so text fits without overflow.`);
    if (headlineVisualLines <= 1) {
      lines.push("- Headline visual capacity: about 1 line. Keep headline to one compact line, avoid list formatting.");
    } else if (headlineVisualLines === 2) {
      lines.push("- Headline visual capacity: about 2 lines. You may use two lines of meaning if the char limit allows; avoid cramped multi-item lists.");
    } else {
      lines.push(
        `- Headline visual capacity: about ${headlineVisualLines} lines. With a high character limit, fill the readable area with substantive headline text (still scannable)—not one short clause floating in empty space.`
      );
    }
  } else {
    lines.push("- Headline zone: absent in this template. Omit headline (use empty string) on every slide.");
  }
  if (m.hasBody) {
    if (bodyMaxChars <= 15)
      lines.push("- Body zone: tiny. One to three words or omit. One word is fine.");
    else if (bodyMaxChars <= 40)
      lines.push(`- Body zone: very small (~${bodyMaxChars} chars). One short phrase or omit.`);
    else if (bodyMaxChars <= 80)
      lines.push(`- Body zone: small (~${bodyMaxChars} chars). One short sentence only.`);
    else if (bodyMaxChars <= 150)
      lines.push(`- Body zone: ~${bodyMaxChars} chars max. One or two short sentences.`);
    else if (bodyMaxChars >= 200)
      lines.push(
        `- Body zone: **large capacity** (~${bodyMaxChars} chars). Use **most** of this budget with **useful** copy: specifics, mini-steps, contrast, or several tight sentences—**not** a single vague line that wastes the layout. Lists are OK when each line stays short and on-topic.`
      );
    else lines.push(`- Body zone: max ~${bodyMaxChars} characters. Keep body within this.`);
    if (bodyVisualLines <= 1) {
      lines.push("- Body visual capacity: about 1 line. Use one short sentence or short phrase. Avoid lists/bullets.");
    } else if (bodyVisualLines === 2) {
      lines.push("- Body visual capacity: about 2 lines. Keep body very concise; list formatting only if truly necessary.");
    } else {
      lines.push(
        `- Body visual capacity: about ${bodyVisualLines} lines. With high char limits, body should **read full** for this template—concrete beats, not padding—while staying within max characters.`
      );
    }
  } else {
    lines.push("- Body zone: absent in this template. Omit body (use empty string or omit) on every slide.");
  }
  if (extraZones.length > 0) {
    lines.push(
      "- **Extra text zones (`slide.extra_text_values`):** Real layout boxes keyed by exact zone `id`. On **every** slide, include a **non-empty** string for each **required** extra zone (any zone where optional is false or omitted). **Optional** zones: include when they add clarity (eyebrow, stat, badge, footnote); omit that key only when leaving it blank reads cleaner for that slide."
    );
    for (const z of extraZones) {
      const zMax = maxCharsForExtraTextZone(z);
      const zLines = visualLinesForZone({
        h: Number(z.h),
        fontSize: Number(z.fontSize) || 28,
        maxLines: Number(z.maxLines) || 2,
        lineHeight: Number(z.lineHeight) || 1.2,
      });
      const zLabel = z.label?.trim();
      const zOptional = z.optional === true;
      const placement = placementBandsForTextZone(z);
      const scaleHint = extraZoneScaleHint(zMax, zLines);
      const roleHint = zLabel
        ? ` Use the editor label "${zLabel}" as the **semantic role** (what this box is for—e.g. kicker vs footer vs stat)—do not ignore it.`
        : " Infer a sensible role from placement and size (e.g. top small box = eyebrow/kicker).";
      lines.push(
        `- Extra zone "${z.id}": max ~${zMax} chars, ~${zLines} visual lines; ${zOptional ? "**optional**" : "**required on every slide**"}.${placement ? ` On-slide placement: ${placement}.` : ""} ${scaleHint}${roleHint}`
      );
    }
    if (extraZones.some((z) => maxCharsForExtraTextZone(z) >= 80)) {
      lines.push(
        "- When an extra zone has a **high** max character count, write **substantive** supporting copy for that role (second headline block, quote + attribution, metric + short context)—not a 3-letter filler unless the slide is intentionally minimal."
      );
    }
    lines.push(
      "- **Do not repeat** the main headline verbatim in an extra zone unless the label/role explicitly calls for a repeated hook line. Extra zones should **complement** headline/body (context, contrast, label, stat, CTA chip)."
    );
    lines.push(
      "- Keys in `extra_text_values` must be **only** the extra zone ids listed above (never invent new keys). Each `shorten_alternate` must include the **same keys** as the main slide for that slide, with values scaled shorter/longer to match short/normal/long like headline/body."
    );
  }
  lines.push(
    "**SCALE TO THE ZONE:** Match **main** slide headline, body, **and each extra text zone** density to the numbers above—**large limits = richer, more concrete copy** that still fits; **tiny limits = telegraphic**. Do not default to generic short copy when the template allows much more. shorten_alternates can still vary short / normal / long."
  );
  lines.push(
    "Do not exceed these character counts. Prefer fewer characters only when the limit is low; it is OK to use a single word or very few words in tiny zones. shorten_alternates can vary in length (short / normal / long)."
  );

  return {
    hasHeadline: m.hasHeadline,
    hasBody: m.hasBody,
    headlineMaxChars: m.hasHeadline ? headlineMaxChars : 0,
    bodyMaxChars: m.hasBody ? bodyMaxChars : 0,
    extraZoneIds: extraZones.map((z) => z.id),
    promptSection: lines.join(" "),
  };
}

function extraZoneScaleHint(zMax: number, zLines: number): string {
  if (zMax <= 14)
    return "Scale: micro-label—1–4 words; stamp, badge, or tiny kicker only.";
  if (zMax <= 32)
    return "Scale: very short—one tight phrase; no long sentences.";
  if (zMax <= 65)
    return "Scale: short supporting line; one idea that backs headline/body without duplicating them.";
  if (zMax >= 110 || zLines >= 4)
    return "Scale: **large**—use most of the budget with on-role copy (mini paragraph, quote block, stat + explanation) so the box does not look empty.";
  return "Scale: one or two clear supporting lines; stay within max chars.";
}

function slotLabelForSelection(index: number, total: number): string {
  if (total >= 3) {
    if (index === 0) return "first slide slot";
    if (index === 1) return "middle slides slot";
    return "last slide slot";
  }
  if (total === 2) {
    if (index === 0) return "first + last slides slot";
    return "middle slides slot";
  }
  return "all slides slot";
}

/**
 * Build prompt context for 1-3 selected templates so the LLM can shape copy by slot.
 * Falls back to the first valid section if slot data is incomplete.
 */
export function buildTemplateContextForPromptSelection(
  templateConfigs: Array<Json | null | undefined>
): string | undefined {
  const sections = templateConfigs
    .map((cfg) => buildTemplateContextForPrompt(cfg)?.promptSection?.trim() ?? "")
    .filter((s) => s.length > 0);
  if (sections.length === 0) return undefined;
  if (sections.length === 1) return sections[0];

  const intro = [
    "MULTI-TEMPLATE SLOT LIMITS:",
    "- Multiple templates are selected for this generation.",
    sections.length >= 3
      ? "- Slot mapping: first slide uses slot 1 limits, middle slides use slot 2 limits, last slide uses slot 3 limits."
      : "- Slot mapping: first and last slides use slot 1 limits, middle slides use slot 2 limits.",
    "- Keep each slide's copy within the limits of the slot used by that slide index.",
    "- **SCALE TO EACH SLOT:** use the full headline/body budget when a slot shows **large** max characters—do not shrink all slots to short generic copy.",
    "- For `slide.extra_text_values`, use **only** the extra zone ids listed in the slot section that applies to that slide (first vs middle vs last)—do not mix zone ids from a different slot.",
  ];

  const slotSections = sections.map((s, i) => {
    const label = slotLabelForSelection(i, sections.length);
    return `\n[${label.toUpperCase()}] ${s}`;
  });

  return `${intro.join(" ")}${slotSections.join(" ")}`.trim();
}
