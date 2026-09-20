import { describe, it, expect } from "vitest";
import {
  isIndianCountry,
  isIndianLanguageInput,
  INDIA_COUNTRY_CODES,
  NON_INDIA_ERROR,
} from "./indianValidation";

describe("isIndianCountry", () => {
  it("accepts ISO code IN", () => {
    expect(isIndianCountry("IN")).toBe(true);
    expect(isIndianCountry("in")).toBe(true);
  });

  it("accepts country names", () => {
    expect(isIndianCountry("India")).toBe(true);
    expect(isIndianCountry("Bharat")).toBe(true);
    expect(isIndianCountry("भारत")).toBe(true);
  });

  it("rejects non-Indian countries", () => {
    expect(isIndianCountry("US")).toBe(false);
    expect(isIndianCountry("Canada")).toBe(false);
  });

  it("rejects blank input", () => {
    expect(isIndianCountry(null)).toBe(false);
    expect(isIndianCountry("")).toBe(false);
    expect(isIndianCountry("   ")).toBe(false);
  });
});

describe("isIndianLanguageInput", () => {
  it("accepts Indian language codes", () => {
    expect(isIndianLanguageInput("hi")).toBe(true);
    expect(isIndianLanguageInput("ta")).toBe(true);
  });

  it("accepts Indian language names", () => {
    expect(isIndianLanguageInput("Hindi")).toBe(true);
    expect(isIndianLanguageInput("Tamil")).toBe(true);
  });

  it("rejects non-Indian languages", () => {
    expect(isIndianLanguageInput("French")).toBe(false);
    expect(isIndianLanguageInput("Spanish")).toBe(false);
    expect(isIndianLanguageInput("German")).toBe(false);
  });

  it("rejects blank input", () => {
    expect(isIndianLanguageInput(undefined)).toBe(false);
    expect(isIndianLanguageInput("")).toBe(false);
    expect(isIndianLanguageInput("   ")).toBe(false);
  });
});

describe("constants", () => {
  it("exports India country codes", () => {
    expect(INDIA_COUNTRY_CODES.has("IN")).toBe(true);
  });

  it("exports non-India error copy", () => {
    expect(NON_INDIA_ERROR.title).toBe("Not supported");
  });
});
