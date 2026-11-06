import { describe, it, expect } from "vitest";
import { sanitizeModelOutput } from "./ollama-client";

describe("ollama-client", () => {
  it("sanitizes <think> reasoning tokens from response", () => {
    const raw = `<think>
The user is asking how I am.
I should answer warmly in character.
</think>
Hey there! I am having a wonderful day, thanks for asking! How are you?`;

    const cleaned = sanitizeModelOutput(raw);
    expect(cleaned).toBe("Hey there! I am having a wonderful day, thanks for asking! How are you?");
  });

  it("handles dangling <think> tag when generation is truncated", () => {
    const raw = `<think>
Checking if the user needs help...`;

    const cleaned = sanitizeModelOutput(raw);
    expect(cleaned).toBe("");
  });

  it("leaves normal responses untouched", () => {
    const normal = "Namaste! Kaise ho aap? It is so nice to talk to you.";
    expect(sanitizeModelOutput(normal)).toBe(normal);
  });
});
