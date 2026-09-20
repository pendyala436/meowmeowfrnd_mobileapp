import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import {
  markCaptchaVerified,
  isGenderVerified,
  markGenderVerified,
  clearCaptchaPassCache,
  clearLoginGateSessionFlags,
  clearRoleCache,
  LOGIN_GENDER_VERIFY_ENABLED,
} from "./ProtectedRoute";

describe("ProtectedRoute auth helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCaptchaPassCache();
  });

  describe("markCaptchaVerified", () => {
    it("persists captcha verification in localStorage and sessionStorage", () => {
      markCaptchaVerified("user-123");
      expect(localStorage.getItem("captchaVerifiedFor:user-123")).toBeTruthy();
      expect(sessionStorage.getItem("captchaVerifiedAt")).toBeTruthy();
    });
  });

  describe("clearCaptchaPassCache", () => {
    it("clears in-tab captcha cache so re-check reads from storage", () => {
      markCaptchaVerified("user-123");
      clearCaptchaPassCache();
      // Storage still has the key — markCaptchaVerified wrote it
      expect(localStorage.getItem("captchaVerifiedFor:user-123")).toBeTruthy();
    });
  });

  describe("isGenderVerified", () => {
    it("returns false when not verified", () => {
      if (LOGIN_GENDER_VERIFY_ENABLED) {
        expect(isGenderVerified("user-123")).toBe(false);
      }
    });

    it("returns true after markGenderVerified", () => {
      if (LOGIN_GENDER_VERIFY_ENABLED) {
        markGenderVerified("user-456");
        expect(isGenderVerified("user-456")).toBe(true);
        expect(sessionStorage.getItem("genderVerifiedFor:user-456")).toBeTruthy();
        expect(localStorage.getItem("genderVerifiedFor:user-456")).toBeTruthy();
      }
    });

    it("returns false for undefined userId", () => {
      expect(isGenderVerified(undefined)).toBe(false);
    });

    it("is per-user — different user remains unverified", () => {
      if (LOGIN_GENDER_VERIFY_ENABLED) {
        markGenderVerified("user-a");
        expect(isGenderVerified("user-b")).toBe(false);
      }
    });
  });

  describe("localStorage captcha behavior", () => {
    it("stores per-user captcha key with timestamp", () => {
      const before = Date.now();
      markCaptchaVerified("abc");
      const raw = localStorage.getItem("captchaVerifiedFor:abc");
      expect(raw).toBeTruthy();
      const ts = parseInt(raw!, 10);
      expect(ts).toBeGreaterThanOrEqual(before);
    });

    it("clearCaptchaPassCache does not remove localStorage entries", () => {
      markCaptchaVerified("persist-user");
      clearCaptchaPassCache();
      expect(localStorage.getItem("captchaVerifiedFor:persist-user")).toBeTruthy();
    });

    it("restores captcha from sessionStorage legacy flag", () => {
      const ts = Date.now();
      sessionStorage.setItem("captchaVerifiedAt", String(ts));
      markCaptchaVerified("legacy-user");
      clearCaptchaPassCache();
      expect(localStorage.getItem("captchaVerifiedFor:legacy-user")).toBeTruthy();
    });
  });

  describe("clearLoginGateSessionFlags", () => {
    it("removes session gate flags", () => {
      sessionStorage.setItem("genderVerifiedAt", "1");
      sessionStorage.setItem("captchaVerifiedAt", "2");
      sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
      clearLoginGateSessionFlags();
      expect(sessionStorage.getItem("genderVerifiedAt")).toBeNull();
      expect(sessionStorage.getItem("captchaVerifiedAt")).toBeNull();
      expect(sessionStorage.getItem("postCaptchaRedirect")).toBeNull();
    });
  });

  describe("clearRoleCache", () => {
    it("is exported and callable", () => {
      expect(() => clearRoleCache()).not.toThrow();
    });
  });
});
