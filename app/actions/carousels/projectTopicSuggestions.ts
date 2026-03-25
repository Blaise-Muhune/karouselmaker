"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getProject, updateProject } from "@/lib/server/db/projects";
import { generateCarouselTopicBatch } from "@/app/actions/carousels/suggestCarouselTopics";
import {
  TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT,
  TOPIC_SUGGESTIONS_MAX_QUEUED,
  parseTopicSuggestionsCache,
  refreshesUsedToday,
  serializeTopicSuggestionsCache,
  utcDayKey,
  type TopicSuggestionsCacheV1,
} from "@/lib/server/topicSuggestions/topicSuggestionsCache";
import { normalizeTopicKey } from "@/lib/server/topicSuggestions/normalizeTopicKey";

export type GetProjectTopicSuggestionsResult =
  | {
      ok: true;
      topics: string[];
      refreshesUsedToday: number;
      refreshesLimit: number;
      maxQueued: number;
    }
  | { ok: false; error: string };

export type RefreshProjectTopicSuggestionsResult =
  | {
      ok: true;
      topics: string[];
      refreshesUsedToday: number;
      refreshesLimit: number;
    }
  | { ok: false; error: string };

export type ConsumeProjectTopicSuggestionResult = { ok: true; topics: string[] } | { ok: false; error: string };

function mergeTopicQueues(existing: string[], incoming: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...existing, ...incoming]) {
    const k = normalizeTopicKey(t);
    if (!k || k.length < 4) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
    if (out.length >= max) break;
  }
  return out;
}

export async function getProjectTopicSuggestions(projectId: string): Promise<GetProjectTopicSuggestionsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found." };
  const cache = parseTopicSuggestionsCache(project.topic_suggestions_cache);
  return {
    ok: true,
    topics: cache.topics ?? [],
    refreshesUsedToday: refreshesUsedToday(cache),
    refreshesLimit: TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT,
    maxQueued: TOPIC_SUGGESTIONS_MAX_QUEUED,
  };
}

export async function refreshProjectTopicSuggestions(
  projectId: string,
  carouselFor?: "instagram" | "linkedin"
): Promise<RefreshProjectTopicSuggestionsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found." };

  const today = utcDayKey();
  let cache = parseTopicSuggestionsCache(project.topic_suggestions_cache);
  let used = refreshesUsedToday(cache);
  if (cache.refresh_day !== today) {
    cache = { ...cache, refresh_day: today, refresh_count: 0 };
    used = 0;
  }
  if (used >= TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT) {
    return { ok: false, error: `You’ve used all ${TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT} topic refreshes for today. Try again tomorrow.` };
  }

  const extraBlocked = new Set<string>();
  for (const t of cache.topics ?? []) {
    extraBlocked.add(normalizeTopicKey(t));
  }

  const batch = await generateCarouselTopicBatch(projectId, {
    carousel_for: carouselFor,
    extraBlockedNormalized: extraBlocked,
  });
  if (!batch.ok) return { ok: false, error: batch.error };

  const merged = mergeTopicQueues(cache.topics ?? [], batch.topics, TOPIC_SUGGESTIONS_MAX_QUEUED);
  const next: TopicSuggestionsCacheV1 = {
    topics: merged,
    refresh_day: today,
    refresh_count: (cache.refresh_day === today ? (cache.refresh_count ?? 0) : 0) + 1,
  };

  await updateProject(user.id, projectId, {
    topic_suggestions_cache: serializeTopicSuggestionsCache(next),
  });

  return {
    ok: true,
    topics: merged,
    refreshesUsedToday: refreshesUsedToday(next),
    refreshesLimit: TOPIC_SUGGESTIONS_DAILY_REFRESH_LIMIT,
  };
}

export async function consumeProjectTopicSuggestion(
  projectId: string,
  topic: string
): Promise<ConsumeProjectTopicSuggestionResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found." };

  const cache = parseTopicSuggestionsCache(project.topic_suggestions_cache);
  const topics = cache.topics ?? [];
  const want = normalizeTopicKey(topic);
  const nextTopics = topics.filter((t) => normalizeTopicKey(t) !== want);
  if (nextTopics.length === topics.length) {
    return { ok: true, topics: nextTopics };
  }

  const next: TopicSuggestionsCacheV1 = {
    ...cache,
    topics: nextTopics,
  };
  await updateProject(user.id, projectId, {
    topic_suggestions_cache: serializeTopicSuggestionsCache(next),
  });
  return { ok: true, topics: nextTopics };
}
