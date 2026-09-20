import { describe, it, expect } from "vitest";
import { ROUTES, APP_NAME, LIMITS } from "./index";

describe("constants/index", () => {
  describe("APP_NAME", () => {
    it("is defined", () => {
      expect(APP_NAME).toBe("Meow Meow Frnd App");
    });
  });

  describe("ROUTES", () => {
    it("includes auth routes", () => {
      expect(ROUTES.HOME).toBe("/");
      expect(ROUTES.FORGOT_PASSWORD).toBe("/forgot-password");
      expect(ROUTES.REGISTER).toBe("/register");
    });

    it("includes main app routes", () => {
      expect(ROUTES.DASHBOARD).toBe("/dashboard");
      expect(ROUTES.WOMEN_DASHBOARD).toBe("/women-dashboard");
      expect(ROUTES.PRIVATE_GROUPS).toBe("/private-groups");
      expect(ROUTES.SETTINGS).toBe("/settings");
    });

    it("includes admin routes", () => {
      expect(ROUTES.ADMIN).toBe("/admin");
      expect(ROUTES.ADMIN_USERS).toBe("/admin/users");
      expect(ROUTES.ADMIN_ANALYTICS).toBe("/admin/analytics");
    });
  });

  describe("LIMITS", () => {
    it("exports expected limit keys", () => {
      expect(LIMITS).toHaveProperty("MAX_MESSAGE_LENGTH");
      expect(LIMITS).toHaveProperty("MAX_BIO_LENGTH");
      expect(LIMITS).toHaveProperty("MAX_PHOTOS");
      expect(LIMITS).toHaveProperty("MAX_INTERESTS");
      expect(LIMITS).toHaveProperty("MAX_LANGUAGES");
      expect(LIMITS).toHaveProperty("MAX_FILE_SIZE_MB");
      expect(LIMITS).toHaveProperty("MAX_PARALLEL_CHATS");
    });

    it("has sensible numeric values", () => {
      expect(LIMITS.MAX_MESSAGE_LENGTH).toBe(2000);
      expect(LIMITS.MAX_PHOTOS).toBe(6);
      expect(LIMITS.MAX_PARALLEL_CHATS).toBe(3);
    });
  });
});
