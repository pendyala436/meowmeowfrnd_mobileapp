import { describe, it, expect } from "vitest";
import { resolveLanguageConfig, hasScriptCharacters, LANGUAGE_REGISTRY } from "../../scripts/ai-worker/language-resolver.js";
import { buildSystemPrompt } from "../../scripts/ai-worker/prompt-builder.js";

describe("Language Resolver & Multilingual Prompt Builder", () => {
  it("resolves exact registered languages correctly", () => {
    const hindi = resolveLanguageConfig("Hindi");
    expect(hindi.name).toBe("Hindi");
    expect(hindi.script).toBe("Devanagari");
    expect(hindi.romanizedVariantName).toBe("Hinglish");

    const telugu = resolveLanguageConfig("Telugu");
    expect(telugu.name).toBe("Telugu");
    expect(telugu.script).toBe("Telugu");
    expect(telugu.romanizedVariantName).toBe("Telugish");

    const tamil = resolveLanguageConfig("Tamil");
    expect(tamil.name).toBe("Tamil");
    expect(tamil.romanizedVariantName).toBe("Tanglish");
  });

  it("dynamically supports all 87 regional categories without Hindi/English defaulting", () => {
    const bhojpuri = resolveLanguageConfig("Bhojpuri");
    expect(bhojpuri.name).toBe("Bhojpuri");
    expect(bhojpuri.conversationalDirective).toContain("Bhojpuri");

    const manipuri = resolveLanguageConfig("Manipuri");
    expect(manipuri.name).toBe("Manipuri");
    expect(manipuri.conversationalDirective).toContain("Manipuri");
  });

  it("detects native script characters accurately", () => {
    const devanagariRange: [number, number] = [0x0900, 0x097f];
    expect(hasScriptCharacters("नमस्ते", devanagariRange)).toBe(true);
    expect(hasScriptCharacters("Hello", devanagariRange)).toBe(false);

    const teluguRange: [number, number] = [0x0c00, 0x0c7f];
    expect(hasScriptCharacters("బాగున్నారా", teluguRange)).toBe(true);
    expect(hasScriptCharacters("Bagunnara", teluguRange)).toBe(false);
  });

  it("builds distinct profile prompt with matching language directive and persona traits", () => {
    const teluguProfile = {
      id: "test-te-1",
      user_id: "u-telugu",
      display_name: "Swathi",
      age: 23,
      primary_language: "Telugu",
      city: "Hyderabad",
      state: "Telangana",
      interests: ["Carnatic music", "Cooking"],
    };

    const prompt = buildSystemPrompt(teluguProfile);
    expect(prompt).toContain("Swathi");
    expect(prompt).toContain("Hyderabad");
    expect(prompt).toContain("Carnatic music");
    expect(prompt).toContain("Telugu (తెలుగు)");
    expect(prompt).toContain("Telugish");
    expect(prompt).not.toContain("Aarya");
  });
});
