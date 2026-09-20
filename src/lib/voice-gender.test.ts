import { describe, expect, it } from "vitest";
import { classifyPitchGender, estimatePitchHz } from "./voice-gender";

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
