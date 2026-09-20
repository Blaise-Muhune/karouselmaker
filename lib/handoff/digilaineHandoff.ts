import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const HANDOFF_TTL_SECONDS = 20 * 60;
export const HANDOFF_TOPIC_MAX = 280;
export const HANDOFF_ANGLE_MAX = 280;
export const HANDOFF_BRIEF_MAX = 600;
export const HANDOFF_TITLE_MAX = 80;
export const HANDOFF_URL_MAX = 200;

export const DIGILAINE_HANDOFF_COOKIE = "km_digilaine_handoff";
export const DIGILAINE_GEN_COOKIE = "km_digilaine_gen";
export const AUTH_NEXT_COOKIE = "km_auth_next";

export const digilaineKarouselHandoffPayloadSchema = z.object({
  v: z.literal(1),
  topic: z.string().trim().min(1).max(HANDOFF_TOPIC_MAX),
  is_marketing: z.boolean(),
  angle: z.string().trim().max(HANDOFF_ANGLE_MAX).optional().default(""),
  product_title: z.string().trim().min(1).max(HANDOFF_TITLE_MAX),
  product_brief: z.string().trim().max(HANDOFF_BRIEF_MAX),
  product_url: z.string().trim().max(HANDOFF_URL_MAX).optional(),
  product_id: z.string().uuid(),
  exp: z.number().int().positive(),
});

export type DigilaineKarouselHandoffPayload = z.infer<typeof digilaineKarouselHandoffPayloadSchema>;

export const digilaineGenPrefillSchema = z.object({
  topic: z.string().trim().min(1).max(HANDOFF_TOPIC_MAX),
  is_marketing: z.boolean(),
  angle: z.string().trim().max(HANDOFF_ANGLE_MAX).optional().default(""),
});

export type DigilaineGenPrefill = z.infer<typeof digilaineGenPrefillSchema>;

function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function signaturesMatch(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "utf8");
  const right = Buffer.from(rightHex, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getDigilaineHandoffSecret(): string | undefined {
  const secret = process.env.DIGILAINE_KAROUSEL_HANDOFF_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : undefined;
}

export function signDigilaineKarouselHandoff(
  payload: DigilaineKarouselHandoffPayload,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(secret, body)}`;
}

export function verifyDigilaineKarouselHandoff(
  token: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { ok: true; payload: DigilaineKarouselHandoffPayload } | { ok: false; error: string } {
  if (!token?.trim()) return { ok: false, error: "Missing handoff token." };
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return { ok: false, error: "Invalid handoff token." };
  const body = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!body || !sig) return { ok: false, error: "Invalid handoff token." };
  const expected = signBody(secret, body);
  if (!signaturesMatch(sig, expected)) return { ok: false, error: "Invalid handoff signature." };

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid handoff payload." };
  }
  const parsed = digilaineKarouselHandoffPayloadSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "Invalid handoff payload." };
  if (parsed.data.exp < nowSeconds) return { ok: false, error: "Handoff expired." };
  if (parsed.data.exp > nowSeconds + HANDOFF_TTL_SECONDS + 300) {
    return { ok: false, error: "Invalid handoff expiry." };
  }
  return { ok: true, payload: parsed.data };
}

export function parseDigilaineHandoffCookie(
  raw: string | undefined | null,
): DigilaineKarouselHandoffPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = digilaineKarouselHandoffPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseDigilaineGenCookie(raw: string | undefined | null): DigilaineGenPrefill | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = digilaineGenPrefillSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function findProjectForDigilaineProductId<T extends { project_rules: unknown }>(
  projects: T[],
  productId: string,
): T | null {
  for (const project of projects) {
    const rules = project.project_rules;
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) continue;
    const id = (rules as { digilaine_product_id?: unknown }).digilaine_product_id;
    if (typeof id === "string" && id === productId) return project;
  }
  return null;
}

export function uniqueProjectName(desired: string, existingNames: string[]): string {
  const base = desired.trim().slice(0, 200) || "Digilaine product";
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  const suffix = " (Digilaine)";
  const withSuffix = `${base.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
  if (!taken.has(withSuffix.toLowerCase())) return withSuffix;
  for (let i = 2; i < 50; i += 1) {
    const extra = ` (${i})`;
    const candidate = `${base.slice(0, Math.max(1, 200 - extra.length))}${extra}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${Date.now()}`.slice(0, 200);
}
