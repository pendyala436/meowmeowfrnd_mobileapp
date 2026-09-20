import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { APP_FEATURES } from "./features.registry";

describe("APP_FEATURES registry coverage", () => {
  it("registers every product feature area", () => {
    expect(APP_FEATURES.length).toBeGreaterThan(0);
    expect(APP_FEATURES.every((f) => f.id && f.name && f.testFile)).toBe(true);
  });

  it.each(APP_FEATURES.map((f) => [f.id, f.testFile] as const))(
    "feature %s resolves to an existing test file (%s)",
    (_id, testFile) => {
      const fullPath = path.resolve(process.cwd(), testFile);
      expect(fs.existsSync(fullPath)).toBe(true);
    },
  );
});
