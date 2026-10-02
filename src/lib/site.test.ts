import { describe, it, expect } from "vitest";
import {
  SITE_ORIGIN,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DEFAULT_TITLE,
  SITE_DEFAULT_DESCRIPTION,
  SITE_OG_IMAGE,
  SITE_LOGO,
  PUBLIC_INDEXABLE_PATHS,
  PAGE_SEO,
  absoluteUrl,
  isPublicIndexablePath,
  getPageSeo,
} from "./site";

describe("site SEO helpers", () => {
  it("exposes stable brand constants", () => {
    expect(SITE_ORIGIN).toMatch(/^https?:\/\//);
    expect(SITE_ORIGIN.endsWith("/")).toBe(false);
    expect(SITE_NAME).toBe("Meow Meow Frnd App");
    expect(SITE_TAGLINE).toBe("Find Your Purrfect Match");
    expect(SITE_DEFAULT_TITLE).toContain(SITE_NAME);
    expect(SITE_DEFAULT_TITLE).toContain(SITE_TAGLINE);
    expect(SITE_DEFAULT_DESCRIPTION.length).toBeGreaterThan(40);
  });

  it("builds absolute asset URLs", () => {
    expect(SITE_OG_IMAGE).toBe(`${SITE_ORIGIN}/meow-meow-logo.png`);
    expect(SITE_LOGO).toBe(`${SITE_ORIGIN}/icons/icon-512x512.png`);
  });

  describe("absoluteUrl", () => {
    it("returns origin root for empty, default, and slash paths", () => {
      expect(absoluteUrl()).toBe(`${SITE_ORIGIN}/`);
      expect(absoluteUrl("/")).toBe(`${SITE_ORIGIN}/`);
      expect(absoluteUrl("")).toBe(`${SITE_ORIGIN}/`);
    });

    it("keeps leading slash paths", () => {
      expect(absoluteUrl("/auth")).toBe(`${SITE_ORIGIN}/auth`);
      expect(absoluteUrl("/install")).toBe(`${SITE_ORIGIN}/install`);
    });

    it("prefixes missing leading slash", () => {
      expect(absoluteUrl("auth")).toBe(`${SITE_ORIGIN}/auth`);
    });
  });

  describe("isPublicIndexablePath", () => {
    it("allows the public indexable set", () => {
      expect(PUBLIC_INDEXABLE_PATHS.has("/about")).toBe(true);
      expect(isPublicIndexablePath("/")).toBe(true);
      expect(isPublicIndexablePath("/auth")).toBe(true);
      expect(isPublicIndexablePath("/install")).toBe(true);
      expect(isPublicIndexablePath("/about")).toBe(true);
      expect(isPublicIndexablePath("/how-it-works")).toBe(true);
      expect(isPublicIndexablePath("/faq")).toBe(true);
    });

    it("normalizes trailing slashes", () => {
      expect(isPublicIndexablePath("/auth/")).toBe(true);
      expect(isPublicIndexablePath("/faq///")).toBe(true);
      expect(isPublicIndexablePath("")).toBe(true);
    });

    it("blocks private and app routes", () => {
      expect(isPublicIndexablePath("/dashboard")).toBe(false);
      expect(isPublicIndexablePath("/admin")).toBe(false);
      expect(isPublicIndexablePath("/chat/abc")).toBe(false);
      expect(isPublicIndexablePath("/wallet")).toBe(false);
    });
  });

  describe("getPageSeo", () => {
    it("returns unique public page meta", () => {
      expect(getPageSeo("/about").title).toContain("About");
      expect(getPageSeo("/faq").description.toLowerCase()).toContain("frequently asked");
      expect(getPageSeo("/how-it-works").title).not.toBe(getPageSeo("/about").title);
      expect(PAGE_SEO["/install"].description.length).toBeGreaterThan(40);
    });

    it("falls back for admin and chat prefixes", () => {
      expect(getPageSeo("/admin/users").title).toContain("Admin");
      expect(getPageSeo("/chat/xyz").title).toContain("Chat");
    });

    it("falls back to site name for unknown paths", () => {
      expect(getPageSeo("/totally-unknown").title).toBe(SITE_NAME);
    });

    it("normalizes empty path to home seo", () => {
      expect(getPageSeo("")).toEqual(PAGE_SEO["/"]);
      expect(getPageSeo("///").title).toBe(PAGE_SEO["/"].title);
    });
  });
});
