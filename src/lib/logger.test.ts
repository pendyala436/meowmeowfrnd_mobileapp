import { describe, it, expect, vi, afterEach } from "vitest";
import { log, warn, error } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("log is callable", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("test message", { foo: 1 });
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith("test message", { foo: 1 });
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("warn is callable", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn("warning");
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith("warning");
    }
  });

  it("error is always callable", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    error("failure", new Error("boom"));
    expect(spy).toHaveBeenCalledWith("failure", expect.any(Error));
  });

  it("does not log in non-dev mode", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const prod = await import("./logger");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    prod.log("hidden");
    prod.warn("hidden");
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
