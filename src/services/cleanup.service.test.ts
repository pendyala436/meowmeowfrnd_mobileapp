import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

import {
  triggerDataCleanup,
  triggerGroupCleanup,
  triggerVideoCleanup,
  verifyPhoto,
  runAllCleanups,
} from "./cleanup.service";

describe("cleanup.service", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("triggerDataCleanup returns success", async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    await expect(triggerDataCleanup()).resolves.toEqual({ success: true, error: undefined });
    expect(invokeMock).toHaveBeenCalledWith("data-cleanup", { body: {} });
  });

  it("triggerDataCleanup preserves explicit failure from edge function", async () => {
    invokeMock.mockResolvedValue({ data: { success: false, error: "partial" }, error: null });
    await expect(triggerDataCleanup()).resolves.toEqual({ success: false, error: "partial" });
  });

  it("triggerDataCleanup defaults success when data omitted", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    await expect(triggerDataCleanup()).resolves.toEqual({ success: true, error: undefined });
  });

  it("triggerDataCleanup handles invoke error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("boom") });
    const result = await triggerDataCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("triggerDataCleanup handles non-Error throw", async () => {
    invokeMock.mockRejectedValue("string error");
    const result = await triggerDataCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("triggerGroupCleanup returns success", async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    await expect(triggerGroupCleanup()).resolves.toEqual({ success: true, error: undefined });
  });

  it("triggerGroupCleanup preserves explicit failure", async () => {
    invokeMock.mockResolvedValue({ data: { success: false, error: "busy" }, error: null });
    expect(await triggerGroupCleanup()).toEqual({ success: false, error: "busy" });
  });

  it("triggerGroupCleanup defaults success and forwards warning", async () => {
    invokeMock.mockResolvedValue({ data: { error: "partial" }, error: null });
    expect(await triggerGroupCleanup()).toEqual({ success: true, error: "partial" });
  });

  it("triggerGroupCleanup handles invoke error result", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("invoke failed") });
    const result = await triggerGroupCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBe("invoke failed");
  });

  it("triggerGroupCleanup handles non-Error throw", async () => {
    invokeMock.mockRejectedValue(42);
    const result = await triggerGroupCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  it("triggerVideoCleanup returns success", async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null });
    const result = await triggerVideoCleanup();
    expect(result.success).toBe(true);
  });

  it("triggerVideoCleanup preserves explicit failure", async () => {
    invokeMock.mockResolvedValue({ data: { success: false, error: "busy" }, error: null });
    expect(await triggerVideoCleanup()).toEqual({ success: false, error: "busy" });
  });

  it("triggerVideoCleanup defaults success when payload omits flag", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    expect(await triggerVideoCleanup()).toEqual({ success: true, error: undefined });
  });

  it("triggerVideoCleanup handles invoke error result", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("invoke failed") });
    const result = await triggerVideoCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBe("invoke failed");
  });

  it("triggerVideoCleanup handles non-Error throw", async () => {
    invokeMock.mockRejectedValue("video down");
    const result = await triggerVideoCleanup();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  describe("verifyPhoto", () => {
    it("returns verification result from edge function", async () => {
      invokeMock.mockResolvedValue({
        data: {
          verified: true,
          detectedGender: "female",
          confidence: 0.95,
          reason: "ok",
          genderMatches: true,
        },
        error: null,
      });
      const result = await verifyPhoto("base64data", "female", "user-1");
      expect(invokeMock).toHaveBeenCalledWith("verify-photo", {
        body: {
          imageBase64: "base64data",
          expectedGender: "female",
          userId: "user-1",
          verificationType: "selfie",
        },
      });
      expect(result).toEqual({
        verified: true,
        detectedGender: "female",
        confidence: 0.95,
        reason: "ok",
        genderMatches: true,
      });
    });

    it("maps snake_case response fields", async () => {
      invokeMock.mockResolvedValue({
        data: {
          verified: false,
          detected_gender: "male",
          gender_matches: false,
        },
        error: null,
      });
      const result = await verifyPhoto("img");
      expect(result.detectedGender).toBe("male");
      expect(result.genderMatches).toBe(false);
    });

    it("returns failure on invoke error", async () => {
      invokeMock.mockResolvedValue({ data: null, error: new Error("fail") });
      const result = await verifyPhoto("img");
      expect(result).toEqual({
        verified: false,
        reason: "Photo verification failed. Please try again.",
      });
    });

    it("defaults missing response fields", async () => {
      invokeMock.mockResolvedValue({ data: {}, error: null });
      const result = await verifyPhoto("img");
      expect(result).toEqual({
        verified: false,
        detectedGender: undefined,
        confidence: undefined,
        reason: undefined,
        genderMatches: undefined,
      });
    });
  });

  describe("runAllCleanups", () => {
    it("runs all three cleanup tasks in parallel", async () => {
      invokeMock.mockResolvedValue({ data: { success: true }, error: null });
      const result = await runAllCleanups();
      expect(invokeMock).toHaveBeenCalledTimes(3);
      expect(result.dataCleanup.success).toBe(true);
      expect(result.groupCleanup.success).toBe(true);
      expect(result.videoCleanup.success).toBe(true);
    });
  });
});
