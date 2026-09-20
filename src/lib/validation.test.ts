import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  emailSchema,
  passwordSchema,
  sanitizeText,
  isValidRedirectUrl,
  validateFileUpload,
  validateImageUpload,
  ClientRateLimiter,
  LIMITS,
} from "./validation";

describe("emailSchema", () => {
  it("accepts valid email and lowercases", () => {
    expect(emailSchema.parse("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow(/valid email/i);
  });

  it("rejects empty email", () => {
    expect(() => emailSchema.parse("")).toThrow(/required/i);
  });
});

describe("passwordSchema", () => {
  it("accepts strong password", () => {
    expect(passwordSchema.parse("Secure1!pass")).toBe("Secure1!pass");
  });

  it("rejects short password", () => {
    expect(() => passwordSchema.parse("Ab1!")).toThrow(/at least/i);
  });

  it("requires uppercase, lowercase, number, and special char", () => {
    expect(() => passwordSchema.parse("alllowercase1!")).toThrow(/uppercase/i);
    expect(() => passwordSchema.parse("ALLUPPERCASE1!")).toThrow(/lowercase/i);
    expect(() => passwordSchema.parse("NoNumbers!!")).toThrow(/number/i);
    expect(() => passwordSchema.parse("NoSpecial1")).toThrow(/special/i);
  });
});

describe("sanitizeText", () => {
  it("strips HTML tags and entities", () => {
    expect(sanitizeText("  <b>Hello</b> &amp; world  ")).toBe("Hello  world");
  });

  it("returns trimmed plain text", () => {
    expect(sanitizeText("  safe text  ")).toBe("safe text");
  });
});

describe("isValidRedirectUrl", () => {
  it("allows same-origin URLs", () => {
    expect(isValidRedirectUrl("/dashboard")).toBe(true);
    expect(isValidRedirectUrl(`${window.location.origin}/profile`)).toBe(true);
  });

  it("rejects external URLs", () => {
    expect(isValidRedirectUrl("https://evil.com/phish")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isValidRedirectUrl("http://[invalid")).toBe(false);
  });
});

describe("validateFileUpload", () => {
  it("accepts valid file", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateFileUpload(file)).toEqual({ valid: true });
  });

  it("rejects oversized file", () => {
    const file = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    expect(validateFileUpload(file, { maxSizeMB: 10 }).valid).toBe(false);
  });

  it("rejects disallowed MIME type", () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 100 });
    const result = validateFileUpload(file, { allowedTypes: ["image/"] });
    expect(result.valid).toBe(false);
  });

  it("rejects dangerous extensions", () => {
    const file = new File(["x"], "malware.exe", { type: "application/octet-stream" });
    Object.defineProperty(file, "size", { value: 100 });
    expect(validateFileUpload(file).valid).toBe(false);
  });

  it("rejects disallowed file extension", () => {
    const file = new File(["x"], "photo.bmp", { type: "image/bmp" });
    Object.defineProperty(file, "size", { value: 100 });
    const result = validateFileUpload(file, { allowedExtensions: ["jpg", "png"] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain(".bmp");
  });

  it("rejects files without extension when extensions required", () => {
    const file = new File(["x"], "noextension", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 100 });
    const result = validateFileUpload(file, { allowedExtensions: ["jpg"] });
    expect(result.valid).toBe(false);
  });
});

describe("validateImageUpload", () => {
  it("accepts image files", () => {
    const file = new File(["x"], "pic.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 500_000 });
    expect(validateImageUpload(file).valid).toBe(true);
  });

  it("rejects non-image extension", () => {
    const file = new File(["x"], "video.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 500_000 });
    expect(validateImageUpload(file).valid).toBe(false);
  });
});

describe("ClientRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts within limit", () => {
    const limiter = new ClientRateLimiter(3, 1000);
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.canProceed()).toBe(false);
  });

  it("resets after window elapses", () => {
    const limiter = new ClientRateLimiter(1, 1000);
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.canProceed()).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.canProceed()).toBe(true);
  });

  it("reports remaining wait time", () => {
    const limiter = new ClientRateLimiter(1, 1000);
    limiter.canProceed();
    limiter.canProceed();
    expect(limiter.getRemainingWaitMs()).toBeGreaterThan(0);
    vi.advanceTimersByTime(1000);
    expect(limiter.getRemainingWaitMs()).toBe(0);
  });

  it("returns zero wait when under attempt limit", () => {
    const limiter = new ClientRateLimiter(3, 1000);
    expect(limiter.getRemainingWaitMs()).toBe(0);
  });
});

describe("LIMITS constants", () => {
  it("exports expected validation limits", () => {
    expect(LIMITS.PASSWORD_MIN).toBe(8);
    expect(LIMITS.EMAIL_MAX).toBe(255);
  });
});
