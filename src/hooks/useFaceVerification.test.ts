import { describe, expect, it } from "vitest";
import {
  GENDER_SUCCESS_MIN,
  MALE_OVERRIDE_MIN,
  calibrateFemaleConfidence,
} from "./useFaceVerification";

describe("female gender verification thresholds", () => {
  it("accepts from 50% upward", () => {
    expect(GENDER_SUCCESS_MIN).toBe(0.5);
  });

  it("only overrides weak male reads below 85%", () => {
    expect(MALE_OVERRIDE_MIN).toBe(0.85);
  });

  it("maps accepted female scores into 80–100%", () => {
    expect(calibrateFemaleConfidence(0.5)).toBe(0.8);
    expect(calibrateFemaleConfidence(1)).toBe(1);
    const mid = calibrateFemaleConfidence(0.75);
    expect(mid).toBeGreaterThanOrEqual(0.8);
    expect(mid).toBeLessThanOrEqual(1);
    expect(calibrateFemaleConfidence(0.55)).toBeGreaterThanOrEqual(0.8);
  });
});
