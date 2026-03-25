import type { Json } from "@/lib/server/db/types";

export const TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT = 2;
export const TOPIC_SUGGESTIONS_MAX_QUEUED = 12;

export type TopicSuggestionsCacheV1 = {
  topics?: string[];
  /** UTC date YYYY-MM-DD for refresh_count */
  refresh_day?: string;
  refresh_count?: number;
};

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseTopicSuggestionsCache(raw: Json | null | undefined): TopicSuggestionsCacheV1 {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const topics = Array.isArray(o.topics)
    ? o.topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
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
    topics: cache.topics ?? [],
    refresh_day: cache.refresh_day ?? utcDayKey(),
    refresh_count: Math.min(TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT, Math.max(0, cache.refresh_count ?? 0)),
  } as unknown as Json;
}

export { utcDayKey };
