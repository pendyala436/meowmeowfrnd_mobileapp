import { describe, expect, it } from "vitest";
import { getThemeChromeHex, hslToHex, themeTokenToHex } from "./themeRegistry";

describe("theme chrome color helpers", () => {
  it("converts HSL to a hex string", () => {
    expect(hslToHex(335, 100, 58)).toMatch(/^#[0-9a-f]{6}$/i);
    // Hot pink family (FRND)
    expect(hslToHex(335, 100, 58).toLowerCase()).toMatch(/^#ff/);
  });

  it("parses theme tokens", () => {
    expect(themeTokenToHex("24 88% 46%").toLowerCase()).toBe(hslToHex(24, 88, 46).toLowerCase());
  });

  it("returns Rose Ember chrome from theme id (not FRND pink)", () => {
    const hex = getThemeChromeHex("rose-ember", false).toLowerCase();
    expect(hex).toBe(hslToHex(24, 88, 46).toLowerCase());
    expect(hex).not.toBe(getThemeChromeHex("frnd", false).toLowerCase());
  });

  it("returns a pink-family color for FRND default theme", () => {
    const hex = getThemeChromeHex("frnd", false).toLowerCase();
    expect(hex).toMatch(/^#ff/);
  });
});
