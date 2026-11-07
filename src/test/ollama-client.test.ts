import { describe, it, expect } from "vitest";
import { sanitizeModelOutput } from "../../scripts/ai-worker/ollama-client";

describe("ollama-client", () => {
  it("strips complete <think> blocks", () => {
    const raw = "<think>Analyzing user sentiment: sad\nFormulating response</think>I am here for you! How was your day?";
    expect(sanitizeModelOutput(raw)).toBe("I am here for you! How was your day?");
  });

  it("strips cut-off/unmatched <think> blocks", () => {
    const raw = "Sure! <think>Processing internal";
    expect(sanitizeModelOutput(raw)).toBe("Sure!");
  });

  it("strips leading role prefixes like 'Priya:' or 'Assistant:'", () => {
    const raw1 = "Priya: Bas abhi chai pee rahi hoon, tum batao!";
    expect(sanitizeModelOutput(raw1)).toBe("Bas abhi chai pee rahi hoon, tum batao!");

    const raw2 = "Assistant: I am doing great!";
    expect(sanitizeModelOutput(raw2)).toBe("I am doing great!");
  });

  it("strips surrounding quotation marks from output", () => {
    const raw = '"Hey! Missed talking to you today 😊"';
    expect(sanitizeModelOutput(raw)).toBe("Hey! Missed talking to you today 😊");
  });

  it("returns empty string if input is empty", () => {
    expect(sanitizeModelOutput("")).toBe("");
  });
});
