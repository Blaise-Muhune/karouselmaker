import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel, listSlides } from "@/lib/server/db";
import {
  textToSpeech,
  textToSpeechWithTimestamps,
  alignmentToWords,
  wordsToCaptionCues,
} from "@/lib/server/tts/elevenlabs";

export const dynamic = "force-dynamic";

/**
 * Compute per-slide duration (seconds) from character alignment.
 * scriptParts[i] = text for slide i; full script = join with spaces.
 */
function slideDurationsFromAlignment(
  scriptParts: string[],
  characterStartSeconds: number[],
  characterEndSeconds: number[]
): number[] {
  if (scriptParts.length === 0 || characterStartSeconds.length === 0) return [];
  let charIdx = 0;
  const durations: number[] = [];
  for (let i = 0; i < scriptParts.length; i++) {
    const len = scriptParts[i]!.length;
    if (len === 0) {
      durations.push(0);
      continue;
    }
    const startIdx = charIdx;
    const endIdx = Math.min(charIdx + len - 1, characterEndSeconds.length - 1);
    charIdx += len + 1;
    const startSec = characterStartSeconds[startIdx] ?? 0;
    const endSec = characterEndSeconds[endIdx] ?? startSec;
    durations.push(Math.max(0, endSec - startSec));
  }
  return durations;
}

/**
 * POST /api/tts
 * Body: { carouselId: string, voiceId?: string, timestamps?: boolean }
 * If timestamps: true → JSON { audioBase64, captionCues, slideDurationsSec } for synced video + Cathy captions.
 * Else → audio/mpeg (full voiceover).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const carouselId = body.carouselId as string | undefined;
  const voiceId =
    (body.voiceId as string | undefined)?.trim() ||
    process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
    "21m00Tcm4TlvDq8ikWAM";
  const withTimestamps = !!body.timestamps;

  if (!carouselId) {
    return NextResponse.json({ error: "Missing carouselId" }, { status: 400 });
  }

  const userId = session.user.id;
  const carousel = await getCarousel(userId, carouselId);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const slides = await listSlides(userId, carouselId);
  if (slides.length === 0) {
    return NextResponse.json({ error: "No slides" }, { status: 400 });
  }

  const scriptParts = slides.map((s) => {
    const headline = (s.headline ?? "").trim();
    const bodyText = (s.body ?? "").trim();
    return [headline, bodyText].filter(Boolean).join(". ");
  });
  const script = scriptParts.filter(Boolean).join(" ");
  if (!script) {
    return NextResponse.json({ error: "No text to speak" }, { status: 400 });
  }

  if (withTimestamps) {
    const result = await textToSpeechWithTimestamps({ voiceId, text: script });
    if (result.ok) {
      const words = alignmentToWords(result.alignment);
      const captionCues = wordsToCaptionCues(words, 3);
      const slideDurationsSec = slideDurationsFromAlignment(
        scriptParts,
        result.alignment.character_start_times_seconds,
        result.alignment.character_end_times_seconds
      );
      const bytes = new Uint8Array(result.audio);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const audioBase64 = btoa(binary);
      return NextResponse.json({
        audioBase64,
        captionCues,
        slideDurationsSec,
      });
    }
    // Fallback: with-timestamps can require a higher tier; use regular TTS so voiceover still works.
    const fallbackAudio = await textToSpeech({ voiceId, text: script });
    if (fallbackAudio) {
      const bytes = new Uint8Array(fallbackAudio);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const audioBase64 = btoa(binary);
      const n = scriptParts.length;
      const totalSec = 30;
      const slideDurationsSec = Array(n).fill(Math.max(0.5, totalSec / n));
      return NextResponse.json({
        audioBase64,
        captionCues: [],
        slideDurationsSec,
        warning: "Timestamps unavailable; using fixed slide timing. " + result.message,
      });
    }
    return NextResponse.json(
      { error: result.message || "TTS failed. Check ELEVENLABS_API_KEY and voiceId." },
      { status: 502 }
    );
  }

  const audio = await textToSpeech({ voiceId, text: script });
  if (!audio) {
    return NextResponse.json(
      { error: "TTS failed. Check ELEVENLABS_API_KEY and voiceId." },
      { status: 502 }
    );
  }

  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
