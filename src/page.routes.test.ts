import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ROUTES } from "@/constants";

/**
 * Static route contract — ensures critical paths in page.tsx stay wired.
 * Prevents regressions like /private-groups 404 after deploy without SPA fallback.
 */
describe("page.tsx route wiring", () => {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/page.tsx"),
    "utf-8",
  );

  const requiredRoutes: Array<{ path: string; label: string }> = [
    { path: 'path="/"', label: "home" },
    { path: 'path="/captcha"', label: "captcha" },
    { path: 'path="/gender-verify"', label: "gender verify" },
    { path: 'path="/dashboard"', label: "men dashboard" },
    { path: 'path="/women-dashboard"', label: "women dashboard" },
    { path: 'path="/private-groups"', label: "private groups alias" },
    { path: 'path="/wallet"', label: "men wallet" },
    { path: 'path="/women-wallet"', label: "women wallet" },
    { path: 'path="/admin"', label: "admin" },
    { path: 'path="/additional-photos"', label: "additional photos registration" },
    { path: 'path="/install"', label: "PWA install" },
  ];

  it.each(requiredRoutes)("defines route for $label", ({ path }) => {
    expect(pageSource).toContain(path);
  });

  it("wraps private-groups in ProtectedRoute", () => {
    expect(pageSource).toMatch(/path="\/private-groups"[\s\S]*ProtectedRoute[\s\S]*PrivateGroupsScreen/);
  });

  it("constants ROUTES align with page paths", () => {
    expect(pageSource).toContain(`path="${ROUTES.PRIVATE_GROUPS}"`);
    expect(pageSource).toContain(`path="${ROUTES.DASHBOARD}"`);
    expect(pageSource).toContain(`path="${ROUTES.WOMEN_DASHBOARD}"`);
    expect(pageSource).toContain(`path="${ROUTES.ADMIN}"`);
  });
});
