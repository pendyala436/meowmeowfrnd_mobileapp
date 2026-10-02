import { describe, it, expect } from "vitest";
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  KNOWS_ABOUT_TOPICS,
  META_KEYWORDS,
  TARGET_SEARCH_INTENTS,
} from "./seo-keywords";

describe("seo-keywords package", () => {
  it("keeps home title/description friendship-focused", () => {
    expect(HOME_TITLE.toLowerCase()).toContain("friends");
    expect(HOME_DESCRIPTION.toLowerCase()).toContain("make friends online");
    expect(HOME_DESCRIPTION.toLowerCase()).not.toContain("dating near me");
  });

  it("limits curated intents and knowsAbout to a quality set", () => {
    expect(TARGET_SEARCH_INTENTS.length).toBeGreaterThanOrEqual(15);
    expect(TARGET_SEARCH_INTENTS.length).toBeLessThanOrEqual(25);
    expect(KNOWS_ABOUT_TOPICS.length).toBeGreaterThanOrEqual(8);
    expect(KNOWS_ABOUT_TOPICS).toContain("make friends online");
    expect(META_KEYWORDS.toLowerCase()).toContain("meow meow frnd");
  });
});
