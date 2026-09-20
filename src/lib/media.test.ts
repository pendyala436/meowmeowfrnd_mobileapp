import { describe, it, expect, vi } from "vitest";
import { isPlayAbortError, playMedia } from "./media";

describe("isPlayAbortError", () => {
  it("returns false for null/undefined", () => {
    expect(isPlayAbortError(null)).toBe(false);
    expect(isPlayAbortError(undefined)).toBe(false);
  });

  it("detects AbortError by name", () => {
    expect(isPlayAbortError({ name: "AbortError", message: "aborted" })).toBe(true);
  });

  it("detects interrupted play() messages", () => {
    expect(
      isPlayAbortError({ message: "The play() request was interrupted by a call to pause()." }),
    ).toBe(true);
    expect(isPlayAbortError("play() request was interrupted")).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isPlayAbortError(new Error("NotAllowedError"))).toBe(false);
  });
});

describe("playMedia", () => {
  it("resolves immediately for null element", async () => {
    await expect(playMedia(null)).resolves.toBeUndefined();
  });

  it("resolves when play succeeds", async () => {
    const el = { play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLMediaElement;
    await expect(playMedia(el)).resolves.toBeUndefined();
    expect(el.play).toHaveBeenCalled();
  });

  it("swallows abort errors", async () => {
    const abortErr = Object.assign(new Error("interrupted"), { name: "AbortError" });
    const el = { play: vi.fn().mockRejectedValue(abortErr) } as unknown as HTMLMediaElement;
    await expect(playMedia(el)).resolves.toBeUndefined();
  });

  it("rethrows non-abort errors", async () => {
    const err = new Error("NotAllowedError");
    const el = { play: vi.fn().mockRejectedValue(err) } as unknown as HTMLMediaElement;
    await expect(playMedia(el)).rejects.toThrow("NotAllowedError");
  });
});
