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
  { id: "antoni", name: "Antoni", description: "Warm, friendly", voiceId: "ErXwobaYiN019PkySvjV" },
  { id: "bella", name: "Bella", description: "Soft, clear", voiceId: "EXAVITQu4vr4xnSDxMaL" },
  { id: "josh", name: "Josh", description: "Young, energetic", voiceId: "TxGEqnHWrfWFTfGW9XjX" },
  { id: "elli", name: "Elli", description: "Conversational", voiceId: "MF3mGyEYCl7XYWbV9V6O" },
  { id: "Oxley", name: "Oxley", description: "Evil, mature", voiceId: "2gPFXx8pN3Avh27Dw5Ma" },
  { id: "Norah", name: "Norah", description: "Whitch, evil", voiceId: "5PWbsfogbLtky5sxqtBz" },
  { id: "Matthews", name: "Matthews", description: "scripture reading", voiceId: "4QLC5fepxZkYmdD2IGRU" },
  { id: "David", name: "David", description: "newsReader", voiceId: "XjLkpWUlnhS8i7gGz3lZ" },
  { id: "Laroque", name: "Laroque", description: "Rare, cinematic deep voice", voiceId: "LifjXiNLcYfyYJD8PCDT" },
  // Add more voices below — use your ElevenLabs voice_id for each:
  // { id: "my-voice", name: "Display Name", description: "Short tagline", voiceId: "YOUR_VOICE_ID" },
];

export const DEFAULT_VOICE_ID = VOICE_PRESETS[0]!.voiceId;
