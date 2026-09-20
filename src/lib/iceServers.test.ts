import { describe, it, expect, vi } from "vitest";
import { ICE_SERVERS, ICE_SERVERS_SFU } from "./iceServers";

describe("ICE_SERVERS", () => {
  it("exports iceServers array on RTCConfiguration", () => {
    expect(ICE_SERVERS).toHaveProperty("iceServers");
    expect(Array.isArray(ICE_SERVERS.iceServers)).toBe(true);
    expect(ICE_SERVERS.iceServers!.length).toBeGreaterThan(0);
  });

  it("includes Google STUN servers", () => {
    const urls = ICE_SERVERS.iceServers!.flatMap((s) =>
      Array.isArray(s.urls) ? s.urls : [s.urls],
    );
    expect(urls.some((u) => u.includes("stun.l.google.com"))).toBe(true);
  });

  it("sets iceCandidatePoolSize", () => {
    expect(ICE_SERVERS.iceCandidatePoolSize).toBe(4);
  });

  it("SFU config uses smaller candidate pool", () => {
    expect(ICE_SERVERS_SFU.iceCandidatePoolSize).toBe(2);
    expect(ICE_SERVERS_SFU.iceServers!.length).toBeGreaterThan(0);
  });

  it("includes TURN servers when env vars are set", async () => {
    vi.stubEnv("VITE_TURN_URL", "turn:turn.example.com:3478");
    vi.stubEnv("VITE_TURN_USERNAME", "user");
    vi.stubEnv("VITE_TURN_CREDENTIAL", "pass");
    vi.resetModules();
    const { ICE_SERVERS: withTurn } = await import("./iceServers");
    const urls = withTurn.iceServers!.flatMap((s) =>
      Array.isArray(s.urls) ? s.urls : [s.urls],
    );
    expect(urls.some((u) => String(u).includes("turn.example.com"))).toBe(true);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("logs STUN-only info in dev when TURN is not configured", async () => {
    vi.stubEnv("VITE_TURN_URL", "");
    vi.stubEnv("VITE_TURN_USERNAME", "");
    vi.stubEnv("VITE_TURN_CREDENTIAL", "");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.resetModules();
    await import("./iceServers");
    if (import.meta.env.DEV) {
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("STUN only"));
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
