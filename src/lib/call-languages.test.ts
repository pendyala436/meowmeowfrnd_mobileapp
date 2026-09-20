import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import {
  normalizeCallLanguage,
  isIndianCallLanguage,
  isGroupCallLanguage,
  pickCallLanguage,
  canCallEachOther,
  canShowOneToOneCallButtons,
  canCallFromOnlineList,
  canJoinGroupCall,
  resolveProfileLanguage,
  fetchCallLanguage,
  assertLanguageCallCapacity,
  assertGroupHostLanguageSlot,
  CALL_LANGUAGE_UNAVAILABLE,
  GROUP_CALL_LANGUAGE_UNAVAILABLE,
  GROUP_CALL_LANGUAGES,
} from "./call-languages";

describe("normalizeCallLanguage", () => {
  it("returns empty for blank input", () => {
    expect(normalizeCallLanguage()).toBe("");
    expect(normalizeCallLanguage("  ")).toBe("");
  });

  it("normalizes aliases and codes", () => {
    expect(normalizeCallLanguage("hi")).toBe("hindi");
    expect(normalizeCallLanguage("hi-IN")).toBe("hindi");
    expect(normalizeCallLanguage("Bangla")).toBe("bengali");
    expect(normalizeCallLanguage("Telugu (India)")).toBe("telugu");
    expect(normalizeCallLanguage("Tamil")).toBe("tamil");
  });

  it("normalizes base language code from locale tag", () => {
    expect(normalizeCallLanguage("mr-latn")).toBe("marathi");
    expect(normalizeCallLanguage("te-latn")).toBe("telugu");
  });

  it("passes through unknown languages lowercased", () => {
    expect(normalizeCallLanguage("Swahili")).toBe("swahili");
    expect(normalizeCallLanguage("foo-bar")).toBe("foo-bar");
    expect(normalizeCallLanguage("-suffix")).toBe("-suffix");
  });
});

describe("isIndianCallLanguage", () => {
  it("accepts the five 1:1 call languages", () => {
    expect(isIndianCallLanguage("Hindi")).toBe(true);
    expect(isIndianCallLanguage("bn")).toBe(true);
    expect(isIndianCallLanguage("Marathi")).toBe(true);
    expect(isIndianCallLanguage("te")).toBe(true);
    expect(isIndianCallLanguage("Tamil")).toBe(true);
  });

  it("rejects English and other languages", () => {
    expect(isIndianCallLanguage("English")).toBe(false);
    expect(isIndianCallLanguage("Punjabi")).toBe(false);
  });
});

describe("isGroupCallLanguage", () => {
  it("accepts scheduled Indian languages", () => {
    expect(isGroupCallLanguage("Odia")).toBe(true);
    expect(GROUP_CALL_LANGUAGES.length).toBeGreaterThan(5);
    expect(isGroupCallLanguage("English")).toBe(false);
  });
});

describe("pickCallLanguage", () => {
  it("prefers Indian call-eligible language over English", () => {
    expect(pickCallLanguage("English", "Hindi", "Bengali")).toBe("Hindi");
  });

  it("falls back to first non-empty candidate", () => {
    expect(pickCallLanguage(null, "English", "")).toBe("English");
    expect(pickCallLanguage()).toBe("");
  });
});

describe("resolveProfileLanguage", () => {
  it("uses primary_language before preferred_language", () => {
    expect(
      resolveProfileLanguage({
        primary_language: "Tamil",
        preferred_language: "English",
        language: "Hindi",
      }),
    ).toBe("Tamil");
  });
});

describe("canCallEachOther", () => {
  it("requires matching Indian call languages", () => {
    expect(canCallEachOther("Hindi", "hi")).toBe(true);
    expect(canCallEachOther("Hindi", "Tamil")).toBe(false);
    expect(canCallEachOther("English", "English")).toBe(false);
  });
});

describe("canShowOneToOneCallButtons", () => {
  it("resolves profile language fields before matching", () => {
    expect(canShowOneToOneCallButtons("English", "Hindi")).toBe(false);
    expect(canShowOneToOneCallButtons("English", "Tamil")).toBe(false);
    expect(canShowOneToOneCallButtons("Hindi", "hi-IN")).toBe(true);
  });
});

describe("canCallFromOnlineList", () => {
  it("shows call buttons in same-language online rows for eligible men", () => {
    expect(canCallFromOnlineList("Hindi", "Tamil", true)).toBe(true);
    expect(canCallFromOnlineList("English", "Hindi", true)).toBe(false);
  });

  it("requires matching languages outside same-language section", () => {
    expect(canCallFromOnlineList("Hindi", "Hindi", false)).toBe(true);
    expect(canCallFromOnlineList("Hindi", "Tamil", false)).toBe(false);
  });
});

describe("canJoinGroupCall", () => {
  it("requires matching group-call languages", () => {
    expect(canJoinGroupCall("Odia", "or")).toBe(true);
    expect(canJoinGroupCall("Odia", "Hindi")).toBe(false);
    expect(canJoinGroupCall("English", "English")).toBe(false);
  });
});

describe("fetchCallLanguage", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  function chain(result: unknown) {
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    return q;
  }

  it("aggregates profile and language tables", async () => {
    fromMock
      .mockReturnValueOnce(chain({ data: { primary_language: "Hindi", preferred_language: "English", language: null } }))
      .mockReturnValueOnce(chain({ data: [{ language_name: "Bengali" }] }))
      .mockReturnValueOnce(chain({ data: null }))
      .mockReturnValueOnce(chain({ data: null }));

    await expect(fetchCallLanguage("user-1")).resolves.toBe("Hindi");
    expect(fromMock).toHaveBeenCalledWith("profiles");
  });

  it("uses female and male profile language fallbacks", async () => {
    fromMock
      .mockReturnValueOnce(chain({ data: null }))
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ data: { primary_language: "Tamil", preferred_language: "English" } }))
      .mockReturnValueOnce(chain({ data: { primary_language: "Bengali", preferred_language: "English" } }));

    await expect(fetchCallLanguage("user-2")).resolves.toBe("Tamil");
  });
});

describe("assertLanguageCallCapacity", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns RPC result when available", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, count: 15, error: "full" }, error: null });
    const result = await assertLanguageCallCapacity("Hindi");
    expect(result).toEqual({ allowed: false, count: 15, error: "full" });
    expect(rpcMock).toHaveBeenCalledWith("assert_language_call_capacity", {
      p_language: "Hindi",
      p_slots: 1,
    });
  });

  it("fails closed for non-Indian language when RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc down" } });
    const result = await assertLanguageCallCapacity("English");
    expect(result).toEqual({ allowed: false, count: 0, error: CALL_LANGUAGE_UNAVAILABLE });
  });

  it("allows Indian language when RPC errors (graceful degrade)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc down" } });
    const result = await assertLanguageCallCapacity("Tamil");
    expect(result).toEqual({ allowed: true, count: 0 });
  });

  it("returns RPC denial when capacity full", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, count: 20, error: "full" }, error: null });
    const result = await assertLanguageCallCapacity("Hindi");
    expect(result).toEqual({ allowed: false, count: 20, error: "full" });
  });

  it("returns allowed with zero count when RPC omits count", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: true }, error: null });
    const result = await assertLanguageCallCapacity("Hindi");
    expect(result).toEqual({ allowed: true, count: 0, error: undefined });
  });

  it("handles empty RPC payload", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await assertLanguageCallCapacity("Hindi");
    expect(result).toEqual({ allowed: false, count: 0, error: undefined });
  });
});

describe("assertGroupHostLanguageSlot", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("rejects non-group languages immediately", async () => {
    const result = await assertGroupHostLanguageSlot("English");
    expect(result).toEqual({ allowed: false, error: GROUP_CALL_LANGUAGE_UNAVAILABLE });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns RPC result for valid group language", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: true }, error: null });
    const result = await assertGroupHostLanguageSlot("Odia");
    expect(result).toEqual({ allowed: true, error: undefined });
  });

  it("allows when RPC errors (graceful degrade)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await assertGroupHostLanguageSlot("Hindi");
    expect(result).toEqual({ allowed: true });
  });

  it("returns host slot denial from RPC", async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, error: "slot taken" }, error: null });
    const result = await assertGroupHostLanguageSlot("Odia");
    expect(result).toEqual({ allowed: false, error: "slot taken" });
  });

  it("returns not allowed when RPC omits allowed flag", async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });
    const result = await assertGroupHostLanguageSlot("Odia");
    expect(result).toEqual({ allowed: false, error: undefined });
  });

  it("handles empty RPC payload", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await assertGroupHostLanguageSlot("Odia");
    expect(result).toEqual({ allowed: false, error: undefined });
  });
});
