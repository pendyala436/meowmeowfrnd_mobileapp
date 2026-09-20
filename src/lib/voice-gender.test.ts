import { describe, expect, it, vi, afterEach } from "vitest";
import { analyseVoiceGenderFromBlob, classifyPitchGender, estimatePitchHz } from "./voice-gender";

describe("classifyPitchGender", () => {
  it("classifies higher pitch as female", () => {
    const r = classifyPitchGender(210);
    expect(r.gender).toBe("female");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("classifies lower pitch as male", () => {
    const r = classifyPitchGender(120);
    expect(r.gender).toBe("male");
  });

  it("returns unknown for invalid pitch", () => {
    expect(classifyPitchGender(0).gender).toBe("unknown");
    expect(classifyPitchGender(500).gender).toBe("unknown");
  });
});

describe("estimatePitchHz", () => {
  it("returns 0 for empty input", () => {
    expect(estimatePitchHz(new Float32Array(0), 44100)).toBe(0);
  });

  it("returns 0 when lag window is invalid", () => {
    expect(estimatePitchHz(new Float32Array(8), 44100)).toBe(0);
  });

  it("returns 0 for silent buffers (zero energy / weak correlation)", () => {
    // Long enough for a valid lag window, but all zeros so autocorrelation
    // never finds a pitch peak (covers denom||1 and bestLag/bestCorr early exit).
    expect(estimatePitchHz(new Float32Array(2000), 16000)).toBe(0);
  });

  it("estimates pitch of a synthetic sine wave", () => {
    const sr = 16000;
    const freq = 200;
    const samples = new Float32Array(sr);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * freq * i) / sr);
    }
    const pitch = estimatePitchHz(samples, sr);
    expect(pitch).toBeGreaterThan(170);
    expect(pitch).toBeLessThan(230);
  });
});

describe("analyseVoiceGenderFromBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("decodes audio and classifies pitch from the channel data", async () => {
    const sr = 16000;
    const freq = 200;
    const samples = new Float32Array(sr);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * freq * i) / sr);
    }

    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue({
      sampleRate: sr,
      getChannelData: () => samples,
    });

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function MockAudioContext(this: {
        decodeAudioData: typeof decodeAudioData;
        close: typeof close;
      }) {
        this.decodeAudioData = decodeAudioData;
        this.close = close;
      }),
    );

    const blob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Blob;

    const result = await analyseVoiceGenderFromBlob(blob);
    expect(decodeAudioData).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(result.gender).toBe("female");
    expect(result.pitchHz).toBeGreaterThan(170);
  });

  it("still closes AudioContext when decode fails", async () => {
    const close = vi.fn().mockRejectedValue(new Error("close failed"));
    const decodeAudioData = vi.fn().mockRejectedValue(new Error("bad audio"));

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function MockAudioContext(this: {
        decodeAudioData: typeof decodeAudioData;
        close: typeof close;
      }) {
        this.decodeAudioData = decodeAudioData;
        this.close = close;
      }),
    );

    const blob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Blob;

    await expect(analyseVoiceGenderFromBlob(blob)).rejects.toThrow("bad audio");
    expect(close).toHaveBeenCalled();
  });
});
