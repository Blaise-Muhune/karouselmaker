# TTS / Voiceover for Video

The app uses **ElevenLabs** by default for AI voiceover (best quality vs cost). You can swap to another provider by changing the TTS client and env vars.

## Recommended APIs (cheap + quality)

| Provider        | Quality | Price (entry)        | Best for                |
|----------------|---------|----------------------|-------------------------|
| **ElevenLabs** | ⭐⭐⭐⭐⭐  | $5/mo (30k chars)    | Natural voice, default  |
| **Unreal Speech** | ⭐⭐⭐⭐ | **Free** 250k chars, $4.99/mo 3M | Cheapest, good quality |
| **PlayHT**     | ⭐⭐⭐⭐  | Free 12.5k chars     | Fast, conversational   |

- **ElevenLabs**: [elevenlabs.io](https://elevenlabs.io) — API key + voice IDs from [dashboard](https://elevenlabs.io/app/voice-library) or `GET https://api.elevenlabs.io/v1/voices`.
- **Unreal Speech**: [unrealspeech.com](https://unrealspeech.com) — Very cheap, [docs](https://docs.unrealspeech.com/).
- **PlayHT**: [play.ht](https://play.ht) — [API docs](https://docs.play.ht/).

## Env (ElevenLabs, default)

```env
# Voiceover (server-only). Get key: https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_API_KEY=
# Optional: default voice_id (e.g. Rachel). List: GET https://api.elevenlabs.io/v1/voices
# ELEVENLABS_DEFAULT_VOICE_ID=
```

## Flow

1. User picks a **voice** (and optionally “With voiceover”) before generating video.
2. Script = concatenation of slide headline + body (or per-slide segments).
3. Server calls TTS API → returns audio (MP3). Word-level timestamps (for burned-in captions) are not used yet.
4. Video is built: **images only** (no overlay), **audio** merged. Minimum duration **30 seconds** (driven by script length / TTS or slide count). Burned-in subtitles (word-level captions) are optional and not yet implemented—would require TTS with alignment/timestamps (e.g. ElevenLabs with `output_format` alignment) and an FFmpeg subtitle filter.

---

## Code locations

| What | Where |
|------|--------|
| TTS API | `app/api/tts/route.ts` — builds script from slides, calls `textToSpeech`, returns `audio/mpeg` |
| ElevenLabs client | `lib/server/tts/elevenlabs.ts` — `textToSpeech()`, `listVoices()` |
| Voice presets (UI) | `lib/video/voices.ts` — `VOICE_PRESETS` (id, name, voiceId) |
| Export + voiceover | `components/editor/EditorExportSection.tsx` — checkbox "With voiceover", `POST /api/tts`, then passes `audioBuffer` into video creation |
| Video merge | `lib/video/createVideoFromImages.ts` — `CreateVideoOptions.audioBuffer`, `minDurationSec`; writes `voiceover.mp3` and muxes with video |

---

## Switching to another provider (Unreal Speech, PlayHT)

1. Add a new client under `lib/server/tts/`, e.g. `unrealspeech.ts` or `playht.ts`, with the same contract: `textToSpeech({ voiceId, text }) => Promise<ArrayBuffer | null>` (and optionally `listVoices()`).
2. In `app/api/tts/route.ts`, replace the import and call:
   - `import { textToSpeech } from "@/lib/server/tts/elevenlabs"` → your new module.
3. Add env vars (e.g. `UNREAL_SPEECH_API_KEY`, `PLAYHT_USER_ID` / `PLAYHT_SECRET`) and use them in the new client. Map your provider's "voice" id to the existing `voiceId` from the request (or add a provider-specific field in the UI).
4. Keep `lib/video/voices.ts` as-is if you still use ElevenLabs voice IDs elsewhere, or introduce a small mapping layer (e.g. preset id → provider + voice id) when you support multiple backends.

---

## Troubleshooting

| Issue | What to check |
|-------|-------------------------------|
| **502 / "TTS failed"** | `ELEVENLABS_API_KEY` set in env; `voiceId` valid (from [voice list](https://api.elevenlabs.io/v1/voices)). |
| **"No text to speak"** | Carousel has at least one slide with headline or body; script is non-empty after trimming. |
| **Unauthorized (401)** | User must be signed in; carousel must belong to the same user. |
| **Voice not changing** | Request body must include `voiceId` (or set `ELEVENLABS_DEFAULT_VOICE_ID`). UI should send the selected preset's `voiceId` when calling `/api/tts`. |
| **Captions not visible in video** | TTS must return word-level timestamps. The app tries two methods: (1) **drawtext** if a TTF font loads (`public/fonts/caption-font.ttf` or CDN); (2) **subtitles** filter (SRT burn-in) if no font. Many FFmpeg.wasm builds include libass (subtitles) but not freetype (drawtext), so SRT burn-in may work when drawtext does not. If neither works, the build may lack both; consider a custom FFmpeg.wasm build with freetype and/or libass. |
