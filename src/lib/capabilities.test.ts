import { describe, it, expect, vi, afterEach } from "vitest";
import {
  supportsWebRTC,
  supportsBackdropFilter,
  isSecureContext,
} from "./capabilities";

describe("supportsWebRTC", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when getUserMedia and RTCPeerConnection exist", () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal("window", { RTCPeerConnection: vi.fn() });
    expect(supportsWebRTC()).toBe(true);
  });

  it("returns false when WebRTC APIs missing", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {});
    expect(supportsWebRTC()).toBe(false);
  });
});

describe("supportsBackdropFilter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when CSS.supports reports backdrop-filter", () => {
    vi.stubGlobal("CSS", {
      supports: vi.fn((prop: string) => prop === "backdrop-filter"),
    });
    expect(supportsBackdropFilter()).toBe(true);
  });

  it("checks webkit prefix fallback", () => {
    vi.stubGlobal("CSS", {
      supports: vi.fn((prop: string) => prop === "-webkit-backdrop-filter"),
    });
    expect(supportsBackdropFilter()).toBe(true);
  });

  it("returns false when CSS is undefined", () => {
    vi.stubGlobal("CSS", undefined);
    expect(supportsBackdropFilter()).toBe(false);
  });
});

describe("isSecureContext", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns window.isSecureContext value", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    expect(isSecureContext()).toBe(true);

    vi.stubGlobal("window", { isSecureContext: false });
    expect(isSecureContext()).toBe(false);
  });
});
