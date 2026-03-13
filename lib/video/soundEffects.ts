/**
 * Viral-style sound effects as WAV (stereo, 44.1kHz, 16-bit).
 * No external files or dependencies — procedural only.
 * Used at intro (riser) and slide transitions (whoosh, impact).
 */

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;
const BITS_PER_SAMPLE = 16;

function writeWavHeader(view: DataView, offset: number, dataSize: number): void {
  view.setUint32(offset + 0, 0x52494646, false); // "RIFF"
  view.setUint32(offset + 4, 36 + dataSize, true);
  view.setUint32(offset + 8, 0x57415645, false); // "WAVE"
  view.setUint32(offset + 12, 0x666d7420, false); // "fmt "
  view.setUint32(offset + 16, 16, true);
  view.setUint16(offset + 20, 1, true); // PCM
  view.setUint16(offset + 22, NUM_CHANNELS, true);
  view.setUint32(offset + 24, SAMPLE_RATE, true);
  view.setUint32(offset + 28, SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), true);
  view.setUint16(offset + 32, NUM_CHANNELS * (BITS_PER_SAMPLE / 8), true);
  view.setUint16(offset + 34, BITS_PER_SAMPLE, true);
  view.setUint32(offset + 36, 0x64617461, false); // "data"
  view.setUint32(offset + 40, dataSize, true);
}

function floatTo16(s: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
}

/** Build WAV buffer from mono float samples (-1..1). Stereo = duplicate. */
function monoToWav(samples: number[]): ArrayBuffer {
  const n = samples.length;
  const dataSize = n * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeWavHeader(view, 0, dataSize);
  for (let i = 0; i < n; i++) {
    const s = floatTo16(samples[i]!);
    const pos = 44 + i * 4;
    view.setInt16(pos, s, true);
    view.setInt16(pos + 2, s, true);
  }
  return buffer;
}

/**
 * Riser — tension build (low to high, ~0.45s). Trending intro for hooks.
 * Noise + rising sine sweep.
 */
export function generateRiserWav(): ArrayBuffer {
  const durationSec = 0.45;
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples: number[] = [];
  const twoPi = 2 * Math.PI;
  let phase = 0;
  const f0 = 60;
  const f1 = 400;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const p = t / durationSec; // 0..1
    const envelope = Math.sin(p * Math.PI) * 0.85; // build then fall
    const freq = f0 + (f1 - f0) * p;
    phase += twoPi * freq / SAMPLE_RATE;
    const tone = Math.sin(phase) * envelope * 0.5;
    const noise = (Math.random() * 2 - 1) * envelope * 0.35;
    samples.push(tone + noise);
  }
  return monoToWav(samples);
}

/**
 * Impact — short punch (~0.08s). Used at transitions for emphasis.
 * Low thump + fast decay.
 */
export function generateImpactWav(): ArrayBuffer {
  const durationSec = 0.08;
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples: number[] = [];
  const twoPi = 2 * Math.PI;
  const freq = 65;
  const decaySec = 0.05;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const decay = Math.exp(-t / decaySec);
    const punch = Math.sin(twoPi * freq * t) * decay * 0.7;
    const noise = (Math.random() * 2 - 1) * decay * 0.2;
    samples.push(punch + noise);
  }
  return monoToWav(samples);
}
