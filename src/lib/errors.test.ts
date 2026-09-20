import { describe, it, expect, vi, afterEach } from "vitest";
import {
  classifyError,
  getErrorMessage,
  resolveErrorMessage,
  logError,
  ErrorCategory,
  ERROR_MESSAGES,
} from "./errors";

describe("classifyError", () => {
  it("classifies null/undefined as unknown", () => {
    const result = classifyError(null);
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.retryable).toBe(true);
    expect(result.message).toBe(ERROR_MESSAGES.system.unknown);
  });

  it("classifies Supabase auth errors by code", () => {
    const result = classifyError({
      __isAuthError: true,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.title).toBe("Incorrect email or password");
    expect(result.retryable).toBe(true);
    expect(result.action).toBeUndefined();
  });

  it("includes action label for auth errors that define one", () => {
    const result = classifyError({
      __isAuthError: true,
      code: "email_not_confirmed",
      message: "Email not confirmed",
    });
    expect(result.action).toBe("Resend verification email");
  });

  it("handles auth errors without message text", () => {
    const result = classifyError({
      __isAuthError: true,
      code: "invalid_credentials",
    });
    expect(result.title).toBe("Incorrect email or password");
  });

  it("classifies AuthApiError by name", () => {
    const result = classifyError({
      name: "AuthApiError",
      code: "user_already_exists",
      message: "User exists",
    });
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.title).toBe("Email already registered");
  });

  it("classifies auth token expiry from message", () => {
    const result = classifyError({
      __isAuthError: true,
      code: "unknown_code",
      message: "JWT expired",
    });
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.title).toBe("Session expired");
  });

  it("classifies auth message fallbacks", () => {
    expect(classifyError({ __isAuthError: true, message: "invalid password" }).title)
      .toBe("Incorrect email or password");
    expect(classifyError({ __isAuthError: true, message: "invalid credential" }).title)
      .toBe("Incorrect email or password");
    expect(classifyError({ __isAuthError: true, message: "email not confirmed yet" }).title)
      .toBe("Email not verified");
    expect(classifyError({ __isAuthError: true, message: "already registered" }).title)
      .toBe("Email already registered");
    expect(classifyError({ __isAuthError: true, message: "rate limit hit" }).category)
      .toBe(ErrorCategory.RATE_LIMIT);
    expect(classifyError({ __isAuthError: true, message: "password weak" }).title)
      .toBe("Password too weak");
    expect(classifyError({ __isAuthError: true, status: 403, message: "forbidden" }).title)
      .toBe("Session expired");
  });

  it("returns generic auth error for unknown auth codes", () => {
    const result = classifyError({ __isAuthError: true, code: "xyz", message: "weird" });
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.title).toBe("Authentication error");
  });

  it("classifies auth errors with empty code", () => {
    const result = classifyError({ __isAuthError: true, code: "", message: "something failed" });
    expect(result.title).toBe("Authentication error");
  });

  it("classifies auth errors without code field", () => {
    const result = classifyError({ __isAuthError: true, message: "something failed" });
    expect(result.title).toBe("Authentication error");
  });

  it("classifies network fetch failures", () => {
    const result = classifyError(new TypeError("Failed to fetch"));
    expect(result.category).toBe(ErrorCategory.NETWORK);
    expect(result.title).toBe("No internet connection");
    expect(result.retryable).toBe(true);
  });

  it("classifies timeout errors as server/network", () => {
    const result = classifyError(new Error("Request timed out"));
    expect(result.title).toBe("Request timed out");
    expect(result.retryable).toBe(true);
  });

  it("classifies aborted requests", () => {
    const result = classifyError(new Error("The operation was aborted"));
    expect(result.title).toBe("Request cancelled");
  });

  it("classifies HTTP status patterns", () => {
    expect(classifyError(new Error("HTTP 502 Bad Gateway")).title)
      .toBe("Server temporarily unavailable");
    expect(classifyError(new Error("500 Internal Server Error")).title).toBe("Server error");
    expect(classifyError(new Error("401 Unauthorized")).title).toBe("Not authorised");
    expect(classifyError(new Error("403 Forbidden")).title).toBe("Access denied");
    expect(classifyError(new Error("404 Not Found")).title).toBe("Not found");
    expect(classifyError(new Error("429 Too Many Requests")).title).toBe("Too many attempts");
  });

  it("classifies database duplicate key errors", () => {
    const result = classifyError({ code: "23505", message: "duplicate key" });
    expect(result.category).toBe(ErrorCategory.DATABASE);
    expect(result.title).toBe("Already exists");
  });

  it("classifies other DB error codes", () => {
    expect(classifyError({ code: "23503" }).title).toBe("Invalid reference");
    expect(classifyError({ code: "PGRST116" }).title).toBe("Not found");
    expect(classifyError({ code: "PGRST301" }).category).toBe(ErrorCategory.DATABASE);
  });

  it("classifies RLS permission DB codes", () => {
    const result = classifyError({ code: "42000", message: "permission denied" });
    expect(result.category).toBe(ErrorCategory.PERMISSION);
    expect(result.title).toBe("Permission denied");
  });

  it("classifies PGRST204 as permission", () => {
    const result = classifyError({ code: "PGRST204", message: "no rows" });
    expect(result.category).toBe(ErrorCategory.PERMISSION);
  });

  it("classifies 42501 from DB map", () => {
    const result = classifyError({ code: "42501", message: "permission denied" });
    expect(result.category).toBe(ErrorCategory.DATABASE);
    expect(result.title).toBe("Permission denied");
  });

  it("classifies storage payload too large by statusCode", () => {
    const result = classifyError({ statusCode: 413, message: "too big" });
    expect(result.category).toBe(ErrorCategory.STORAGE);
    expect(result.title).toBe("File too large");
  });

  it("classifies storage errors from message", () => {
    expect(classifyError(new Error("invalid file type")).title).toBe("File type not allowed");
    expect(classifyError(new Error("object not found")).title).toBe("File not found");
    expect(classifyError(new Error("Bucket not found")).title).toBe("Upload unavailable");
  });

  it("classifies media device errors", () => {
    expect(classifyError({ name: "NotAllowedError" }).category).toBe(ErrorCategory.MEDIA);
    expect(classifyError({ name: "NotFoundError" }).retryable).toBe(false);
    expect(classifyError({ name: "NotReadableError" }).title).toContain("in use");
    expect(classifyError({ name: "OverconstrainedError" }).title).toContain("settings");
    expect(classifyError({ name: "AbortError" }).title).toBe("Camera access cancelled");
  });

  it("classifies FunctionsHttpError statuses", () => {
    expect(classifyError({ name: "FunctionsHttpError", status: 401 }).category)
      .toBe(ErrorCategory.AUTH);
    expect(classifyError({ context: {}, status: 403 }).title).toBe("Session expired");
    expect(classifyError({ context: {}, status: 429 }).category).toBe(ErrorCategory.RATE_LIMIT);
    expect(classifyError({ context: {}, status: 503 }).category).toBe(ErrorCategory.SERVER);
    expect(classifyError({ context: {}, status: 400 }).title).toBe("Request failed");
  });

  it("classifies session and payment message strings", () => {
    expect(classifyError(new Error("User not authenticated")).category).toBe(ErrorCategory.AUTH);
    expect(classifyError(new Error("session expired")).action).toBe("Log in");
    expect(classifyError(new Error("insufficient balance")).category).toBe(ErrorCategory.PAYMENT);
    expect(classifyError(new Error("not enough balance")).action).toBe("Top up wallet");
  });

  it("classifies permission and rate limit message strings", () => {
    expect(classifyError(new Error("permission denied")).category).toBe(ErrorCategory.PERMISSION);
    expect(classifyError(new Error("access denied")).title).toBe("Permission denied");
    expect(classifyError(new Error("rate limit exceeded")).category).toBe(ErrorCategory.RATE_LIMIT);
    expect(classifyError(new Error("too many attempts")).title).toBe("Too many attempts");
  });

  it("classifies file size message strings", () => {
    const result = classifyError(new Error("file too large for upload"));
    expect(result.category).toBe(ErrorCategory.STORAGE);
    expect(result.title).toBe("File too large");
    expect(classifyError(new Error("invalid file size")).title).toBe("File too large");
  });

  it("classifies string errors directly", () => {
    const result = classifyError("Failed to fetch data");
    expect(result.category).toBe(ErrorCategory.NETWORK);
  });

  it("classifies errors without message as unknown", () => {
    const result = classifyError({ code: 123 });
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.title).toBe("Something went wrong");
  });

  it("classifies unknown errors with optional context", () => {
    const result = classifyError({ message: "something weird happened" }, "Save profile");
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.message).toContain("save profile");
  });
});

describe("getErrorMessage", () => {
  it("returns classified message", () => {
    expect(getErrorMessage({ __isAuthError: true, code: "weak_password", message: "weak" }))
      .toContain("6 characters");
  });

  it("uses fallback when message empty", () => {
    expect(getErrorMessage(null, "Custom fallback")).toBe(ERROR_MESSAGES.system.unknown);
  });
});

describe("resolveErrorMessage", () => {
  it("prefers classified message", () => {
    expect(
      resolveErrorMessage({
        title: "t",
        message: "Primary",
        retryable: false,
        category: ErrorCategory.UNKNOWN,
      }),
    ).toBe("Primary");
  });

  it("uses fallback when message is empty", () => {
    expect(
      resolveErrorMessage(
        { title: "t", message: "", retryable: false, category: ErrorCategory.UNKNOWN },
        "Backup message",
      ),
    ).toBe("Backup message");
  });

  it("uses system unknown when no message or fallback", () => {
    expect(
      resolveErrorMessage({
        title: "t",
        message: "",
        retryable: false,
        category: ErrorCategory.UNKNOWN,
      }),
    ).toBe(ERROR_MESSAGES.system.unknown);
  });
});

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs to console.error in dev with context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError(new Error("boom"), "Auth");
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith("[AppError] [Auth]", expect.any(Error));
    }
  });

  it("logs without context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("plain error");
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalled();
    }
  });
});
