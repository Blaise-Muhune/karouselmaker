/**
 * Generate a short "whoosh" sound effect (noise burst with decay) as WAV.
 * Used for viral-style transition SFX in video; no external file required.
 * ~0.2s, stereo, 44.1kHz.
 */
export function generateWhooshWav(): ArrayBuffer {
  const sampleRate = 44100;
  const durationSec = 0.22;
  const decaySec = 0.08;
  const samplesPerChannel = Math.floor(sampleRate * durationSec);
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = samplesPerChannel * numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const offset = 0;
  // WAV header
  view.setUint32(offset + 0, 0x52494646, false); // "RIFF"
  view.setUint32(offset + 4, 36 + dataSize, true); // file size - 8
  view.setUint32(offset + 8, 0x57415645, false); // "WAVE"
  view.setUint32(offset + 12, 0x666d7420, false); // "fmt "
  view.setUint32(offset + 16, 16, true); // subchunk1 size
  view.setUint16(offset + 20, 1, true); // PCM
  view.setUint16(offset + 22, numChannels, true);
  view.setUint32(offset + 24, sampleRate, true);
  view.setUint32(offset + 28, byteRate, true);
  view.setUint16(offset + 32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(offset + 34, bitsPerSample, true);
  view.setUint32(offset + 36, 0x64617461, false); // "data"
  view.setUint32(offset + 40, dataSize, true);
  // Noise with exponential decay (whoosh feel)
  const decaySamples = Math.floor(decaySec * sampleRate);
  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-t / decaySec);
    const noise = (Math.random() * 2 - 1) * decay * 0.35;
    const sample = Math.max(-32768, Math.min(32767, Math.round(noise * 32767)));
    const pos = 44 + i * 4;
    view.setInt16(pos, sample, true); // L
    view.setInt16(pos + 2, sample, true); // R
  }
  return buffer;
}
