/**
 * ElevenLabs TTS: cheap starter ($5/mo), very good quality.
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 * With timestamps: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
 */

const API_BASE = "https://api.elevenlabs.io/v1";

export type ElevenLabsOptions = {
  voiceId: string;
  text: string;
  /** Model: eleven_multilingual_v2 (default), eleven_monolingual_v1, etc. */
  modelId?: string;
};

/** Character-level alignment from ElevenLabs with-timestamps API. */
export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** Word-level timing derived from character alignment. */
export type WordTiming = { word: string; start: number; end: number };

/** Caption cue: 1–3 words to show at a time (Cathy style). */
export type CaptionCue = { text: string; start: number; end: number };

/**
 * Generate speech and return audio bytes (MP3). Returns null if API key missing or request fails.
 */
export async function textToSpeech(options: ElevenLabsOptions): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const { voiceId, text, modelId = "eleven_multilingual_v2" } = options;
  if (!text.trim()) return null;

  const res = await fetch(`${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: modelId,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) return null;
  return res.arrayBuffer();
}

export type TtsWithTimestampsResult =
  | { ok: true; audio: ArrayBuffer; alignment: Alignment }
  | { ok: false; status: number; message: string };

/**
 * Generate speech with character-level timestamps.
 * Use for syncing slide duration and burning Cathy-style captions (1–3 words at a time).
 * Returns error details so the API can surface them or fall back to regular TTS.
 */
export async function textToSpeechWithTimestamps(
  options: ElevenLabsOptions
): Promise<TtsWithTimestampsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, status: 0, message: "ELEVENLABS_API_KEY is not set" };

  const { voiceId, text, modelId = "eleven_multilingual_v2" } = options;
  if (!text.trim()) return { ok: false, status: 0, message: "No text to speak" };

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
        }),
        signal: AbortSignal.timeout(60000),
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, message: `Request failed: ${msg}` };
  }

  if (!res.ok) {
    let message: string;
    try {
      const body = (await res.json()) as { detail?: { message?: string }; message?: string };
      message = body.detail?.message ?? body.message ?? res.statusText;
    } catch {
      message = res.statusText;
    }
    return { ok: false, status: res.status, message: `ElevenLabs ${res.status}: ${message}` };
  }

  const data = (await res.json()) as {
    audio_base64?: string;
    alignment?: Alignment;
  };
  if (!data.audio_base64 || !data.alignment) {
    return { ok: false, status: 200, message: "ElevenLabs response missing audio_base64 or alignment" };
  }

  const binary = atob(data.audio_base64);
  const audio = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) audio[i] = binary.charCodeAt(i);
  return { ok: true, audio: audio.buffer, alignment: data.alignment };
}

/** Group character alignment into words (split on spaces). */
export function alignmentToWords(alignment: Alignment): WordTiming[] {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const words: WordTiming[] = [];
  let i = 0;
  while (i < characters.length) {
    let j = i;
    while (j < characters.length && characters[j] !== " ") j++;
    if (j > i) {
      const word = characters.slice(i, j).join("");
      words.push({ word, start: starts[i]!, end: ends[j - 1]! });
    }
    i = j + 1;
  }
  return words;
}

/** Group words into 1–3 word caption cues (Cathy style). */
export function wordsToCaptionCues(words: WordTiming[], maxWordsPerCue = 3): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerCue) {
    const chunk = words.slice(i, i + maxWordsPerCue);
    if (chunk.length === 0) continue;
    cues.push({
      text: chunk.map((w) => w.word).join(" "),
      start: chunk[0]!.start,
      end: chunk[chunk.length - 1]!.end,
    });
  }
  return cues;
}

/**
 * Fetch list of available voices (for UI). Returns [] if API key missing or request fails.
 */
export async function listVoices(): Promise<{ voice_id: string; name: string }[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  const res = await fetch(`${API_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { voices?: { voice_id: string; name: string }[] };
  return (data.voices ?? []).map((v) => ({ voice_id: v.voice_id, name: v.name }));
}
