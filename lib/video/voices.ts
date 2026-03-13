/**
 * Voice presets for video voiceover (ElevenLabs voice_id).
 * User picks one before generating video. List more: GET https://api.elevenlabs.io/v1/voices
 */
export type VoicePreset = {
  id: string;
  name: string;
  description?: string;
  /** ElevenLabs voice_id */
  voiceId: string;
};

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "rachel", name: "Rachel", description: "Calm, professional", voiceId: "21m00Tcm4TlvDq8ikWAM" },
  { id: "adam", name: "Adam", description: "Deep, engaging", voiceId: "pNInz6obpgDQGcFmaJgB" },
  { id: "alex", name: "Alex", description: "Upbeat, energetic and clear", voiceId: "yl2ZDV1MzN4HbQJbMihG" },
  { id: "bella", name: "Bella", description: "Soft, clear", voiceId: "EXAVITQu4vr4xnSDxMaL" },
  { id: "Oxley", name: "Oxley", description: "Evil, mature", voiceId: "2gPFXx8pN3Avh27Dw5Ma" },
  { id: "Norah", name: "Norah", description: "Whitch, evil", voiceId: "5PWbsfogbLtky5sxqtBz" },
  { id: "Matthews", name: "Matthews", description: "scripture reading", voiceId: "4QLC5fepxZkYmdD2IGRU" },
  { id: "David", name: "David", description: "newsReader", voiceId: "XjLkpWUlnhS8i7gGz3lZ" },
  { id: "Laroque", name: "Laroque", description: "Rare, cinematic deep voice", voiceId: "LifjXiNLcYfyYJD8PCDT" },
  { id: "peter", name: "Peter", description: "Credible narrator", voiceId: "ZthjuvLPty3kTMaNKVKb" },
  { id: "jon", name: "Jon", description: "Warm and grounded storyteller", voiceId: "MFZUKuGQUsGJPQjTS4wC" },
  { id: "frederick", name: "Frederick", description: "Nature, science, history and related", voiceId: "j9jfwdrw7BRfcR43Qohk" },
  { id: "clyde", name: "Clyde", description: "British man, deep, diplomatic", voiceId: "wyWA56cQNU2KqUW4eCsI" },
  { id: "knox", name: "Knox", description: "Variant deep voice, advert", voiceId: "dPah2VEoifKnZT37774q" },
  { id: "david_trailer", name: "David (trailer)", description: "Movie trailer narrator", voiceId: "FF7KdobWPaiR0vkcALHF" },
  { id: "cherry", name: "Cherry", description: "Cartoon girl", voiceId: "XJ2fW4ybq7HouelYYGcL" },
  { id: "lulu", name: "Lulu", description: "Sweet bubbly girl", voiceId: "ocZQ262SsZb9RIxcQBOj" },
  { id: "littledude", name: "Little Dude", description: "Cartoon character boy", voiceId: "fBD19tfE58bkETeiwUoC" },
  { id: "carter", name: "Carter", description: "Rich, smooth and rugged, inspiring", voiceId: "qNkzaJoHLLdpvgh5tISm" },
  // Add more voices below — use your ElevenLabs voice_id for each:
  // { id: "my-voice", name: "Display Name", description: "Short tagline", voiceId: "YOUR_VOICE_ID" },
];

export const DEFAULT_VOICE_ID = VOICE_PRESETS[0]!.voiceId;
/** Default voice for video preview (Adam). */
export const ADAM_VOICE_ID = VOICE_PRESETS.find((p) => p.id === "adam")?.voiceId ?? VOICE_PRESETS[0]!.voiceId;
