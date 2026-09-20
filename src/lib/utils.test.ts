import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cn, formatChatTime } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatChatTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T14:30:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows time for messages from today", () => {
    const today = "2026-09-01T10:15:00";
    const result = formatChatTime(today);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns Yesterday for messages from previous calendar day", () => {
    vi.setSystemTime(new Date("2026-09-02T14:30:00"));
    expect(formatChatTime("2026-09-01T10:00:00")).toBe("Yesterday");
  });

  it("returns weekday for messages within the past week", () => {
    const result = formatChatTime("2026-08-28T09:00:00");
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  });

  it("returns month and day for older messages", () => {
    const result = formatChatTime("2026-07-15T09:00:00");
    expect(result).toMatch(/Jul\s+15/);
  });
});
