/**
 * Estimate speaker gender from short voice samples via fundamental frequency (pitch).
 * Adult female speech typically sits higher (~165–255 Hz) than adult male (~85–180 Hz).
 * This is a client-side heuristic — not medical-grade biometric ID.
 */

export type VoiceGender = "male" | "female" | "unknown";

export interface VoiceGenderResult {
  gender: VoiceGender;
  pitchHz: number;
  confidence: number;
}

/** Autocorrelation-based fundamental frequency for a mono PCM buffer. */
export function estimatePitchHz(samples: Float32Array, sampleRate: number): number {
  if (!samples.length || sampleRate <= 0) return 0;

  // Focus on speech band
  const minF = 70;
  const maxF = 300;
  const minLag = Math.floor(sampleRate / maxF);
  const maxLag = Math.min(Math.floor(sampleRate / minF), samples.length - 1);
  if (maxLag <= minLag) return 0;

  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let normA = 0;
    let normB = 0;
    const n = samples.length - lag;
    for (let i = 0; i < n; i++) {
      const a = samples[i];
      const b = samples[i + lag];
      corr += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB) || 1;
    const score = corr / denom;
    if (score > bestCorr) {
      bestCorr = score;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 0.2) return 0;
  return sampleRate / bestLag;
}

export function classifyPitchGender(pitchHz: number): VoiceGenderResult {
  if (!pitchHz || pitchHz < 60 || pitchHz > 400) {
    return { gender: "unknown", pitchHz: pitchHz || 0, confidence: 0 };
  }
  // Midpoint around ~165 Hz separates typical adult male/female ranges
  if (pitchHz >= 165) {
    const confidence = Math.min(1, (pitchHz - 165) / 60 + 0.55);
    return { gender: "female", pitchHz, confidence };
  }
  const confidence = Math.min(1, (165 - pitchHz) / 60 + 0.55);
  return { gender: "male", pitchHz, confidence };
}

/** Analyse an AudioBuffer (e.g. from MediaRecorder blob decoded via AudioContext). */
export async function analyseVoiceGenderFromBlob(blob: Blob): Promise<VoiceGenderResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audio.getChannelData(0);
    // Use a centered ~1.5s window for stability
    const windowSamples = Math.min(channel.length, Math.floor(audio.sampleRate * 1.5));
    const start = Math.max(0, Math.floor((channel.length - windowSamples) / 2));
    const slice = channel.subarray(start, start + windowSamples);
    const pitch = estimatePitchHz(slice, audio.sampleRate);
    return classifyPitchGender(pitch);
  } finally {
    await ctx.close().catch(() => {});
  }
}
