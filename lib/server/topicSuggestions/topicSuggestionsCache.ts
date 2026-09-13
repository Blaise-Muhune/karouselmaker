import type { Json } from "@/lib/server/db/types";
import { normalizeTopicKey } from "@/lib/server/topicSuggestions/normalizeTopicKey";

export const TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT = 2;
export const TOPIC_SUGGESTIONS_MAX_QUEUED = 12;

export type TopicSuggestionItem = {
  topic: string;
  /** Once true (AI or user), stays locked on for this lineup item. */
  is_marketing: boolean;
};

export type TopicSuggestionsCacheV1 = {
  topics?: TopicSuggestionItem[];
  /** UTC date YYYY-MM-DD for refresh_count */
  refresh_day?: string;
  refresh_count?: number;
};

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function coerceTopicItem(raw: unknown): TopicSuggestionItem | null {
  if (typeof raw === "string") {
    const topic = raw.trim();
    if (!topic) return null;
    return { topic, is_marketing: false };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const topic =
      typeof o.topic === "string"
        ? o.topic.trim()
        : typeof o.text === "string"
          ? o.text.trim()
          : "";
    if (!topic) return null;
    return { topic, is_marketing: o.is_marketing === true || o.isMarketing === true };
  }
  return null;
}

export function parseTopicSuggestionsCache(raw: Json | null | undefined): TopicSuggestionsCacheV1 {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const topics = Array.isArray(o.topics)
    ? o.topics.map(coerceTopicItem).filter((t): t is TopicSuggestionItem => t != null)
    : [];
  const refresh_day = typeof o.refresh_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.refresh_day) ? o.refresh_day : undefined;
  const refresh_count =
    typeof o.refresh_count === "number" && Number.isFinite(o.refresh_count) && o.refresh_count >= 0
      ? Math.min(99, Math.floor(o.refresh_count))
      : 0;
  return { topics, refresh_day, refresh_count };
}

export function refreshesUsedToday(cache: TopicSuggestionsCacheV1): number {
  const today = utcDayKey();
  if (cache.refresh_day !== today) return 0;
  return Math.min(TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT, cache.refresh_count ?? 0);
}

export function serializeTopicSuggestionsCache(cache: TopicSuggestionsCacheV1): Json {
  return {
    topics: (cache.topics ?? []).map((t) => ({
      topic: t.topic,
      is_marketing: !!t.is_marketing,
    })),
    refresh_day: cache.refresh_day ?? utcDayKey(),
    refresh_count: Math.min(TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT, Math.max(0, cache.refresh_count ?? 0)),
  } as unknown as Json;
}

export function mergeTopicItemQueues(
  existing: TopicSuggestionItem[],
  incoming: TopicSuggestionItem[],
  max: number
): TopicSuggestionItem[] {
  const byKey = new Map<string, TopicSuggestionItem>();
  for (const t of [...existing, ...incoming]) {
    const k = normalizeTopicKey(t.topic);
    if (!k || k.length < 4) continue;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { topic: t.topic.trim(), is_marketing: !!t.is_marketing });
    } else {
      // Marketing flag only turns on, never off.
      byKey.set(k, {
        topic: prev.topic,
        is_marketing: prev.is_marketing || !!t.is_marketing,
      });
    }
    if (byKey.size >= max * 2) break;
  }
  return [...byKey.values()].slice(0, max);
}

export { utcDayKey };
