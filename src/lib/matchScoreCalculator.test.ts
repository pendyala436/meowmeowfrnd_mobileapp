import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateMatchScore,
  getQuickMatchScore,
  type UserProfile,
} from "./matchScoreCalculator";

vi.mock("@/lib/profile-queries", () => ({
  fetchPublicProfile: vi.fn(),
}));

import { fetchPublicProfile } from "@/lib/profile-queries";

const baseProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  user_id: "u1",
  ...overrides,
});

describe("calculateMatchScore", () => {
  it("scores zero for empty profiles with no overlap", () => {
    const result = calculateMatchScore(baseProfile(), baseProfile({ user_id: "u2" }));
    expect(result.totalScore).toBe(0);
    expect(result.breakdown.languageScore).toBe(0);
  });

  it("awards language points for common languages", () => {
    const current = baseProfile({ preferred_language: "English" });
    const other = baseProfile({ user_id: "u2" });
    const result = calculateMatchScore(
      current,
      other,
      ["Hindi", "English"],
      ["Hindi", "Tamil"],
    );
    expect(result.breakdown.languageScore).toBe(20);
  });

  it("adds bonus for additional common languages", () => {
    const result = calculateMatchScore(
      baseProfile(),
      baseProfile({ user_id: "u2" }),
      ["Hindi", "Tamil", "Bengali"],
      ["Hindi", "Tamil", "Bengali"],
    );
    expect(result.breakdown.languageScore).toBe(30);
  });

  it("falls back to preferred_language match", () => {
    const result = calculateMatchScore(
      baseProfile({ preferred_language: "Hindi" }),
      baseProfile({ user_id: "u2", preferred_language: "Hindi" }),
    );
    expect(result.breakdown.languageScore).toBe(15);
  });

  it("awards location points for same country and state", () => {
    const result = calculateMatchScore(
      baseProfile({ country: "India", state: "Maharashtra" }),
      baseProfile({ user_id: "u2", country: "India", state: "Maharashtra" }),
    );
    expect(result.breakdown.locationScore).toBe(20);
  });

  it("awards interest overlap points", () => {
    const result = calculateMatchScore(
      baseProfile({ interests: ["Music", "Travel"] }),
      baseProfile({ user_id: "u2", interests: ["music", "Food", "Travel"] }),
    );
    expect(result.breakdown.interestsScore).toBe(8);
  });

  it("awards lifestyle matches", () => {
    const result = calculateMatchScore(
      baseProfile({
        religion: "Hindu",
        smoking_habit: "Never",
        zodiac_sign: "Leo",
      }),
      baseProfile({
        user_id: "u2",
        religion: "hindu",
        smoking_habit: "Never",
        zodiac_sign: "Aries",
      }),
    );
    expect(result.breakdown.lifestyleScore).toBeGreaterThan(0);
  });

  it("awards profile completeness for the other user", () => {
    const result = calculateMatchScore(
      baseProfile(),
      baseProfile({
        user_id: "u2",
        bio: "A detailed bio that is longer than twenty chars",
        photo_url: "https://example.com/p.jpg",
        age: 28,
        occupation: "Engineer",
        education_level: "Graduate",
        country: "India",
      }),
      [],
      ["Hindi"],
    );
    expect(result.breakdown.profileScore).toBeGreaterThan(0);
  });

  it("caps total score at 100", () => {
    const result = calculateMatchScore(
      baseProfile({
        country: "India",
        state: "Kerala",
        interests: ["A", "B", "C", "D", "E"],
        religion: "Hindu",
        education_level: "Graduate",
        marital_status: "Single",
        smoking_habit: "Never",
        drinking_habit: "Never",
        dietary_preference: "Veg",
        fitness_level: "Active",
        pet_preference: "Dogs",
        zodiac_sign: "Leo",
      }),
      baseProfile({
        user_id: "u2",
        country: "India",
        state: "Kerala",
        interests: ["A", "B", "C", "D", "E"],
        religion: "Hindu",
        education_level: "Graduate",
        marital_status: "Single",
        smoking_habit: "Never",
        drinking_habit: "Never",
        dietary_preference: "Veg",
        fitness_level: "Active",
        pet_preference: "Dogs",
        zodiac_sign: "Aries",
        bio: "Complete profile bio text here",
        photo_url: "https://example.com/p.jpg",
        age: 25,
        occupation: "Doctor",
      }),
      ["Hindi", "English", "Tamil", "Bengali"],
      ["Hindi", "English", "Tamil", "Bengali"],
    );
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.totalScore).toBeGreaterThan(50);
  });
});

describe("getQuickMatchScore", () => {
  const supabaseMock = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(fetchPublicProfile).mockReset();
    supabaseMock.from.mockReset();
  });

  function profileChain(data: unknown) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data }),
    };
  }

  function langsChain(data: unknown) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data }),
    };
  }

  it("returns calculated score when profiles exist", async () => {
    supabaseMock.from
      .mockReturnValueOnce(
        profileChain({
          user_id: "me",
          country: "India",
          preferred_language: "Hindi",
        }),
      )
      .mockReturnValueOnce(langsChain([{ language_name: "Hindi" }]))
      .mockReturnValueOnce(langsChain([{ language_name: "Hindi" }]));

    vi.mocked(fetchPublicProfile).mockResolvedValue({
      user_id: "other",
      country: "India",
      preferred_language: "Hindi",
    } as Awaited<ReturnType<typeof fetchPublicProfile>>);

    const score = await getQuickMatchScore(supabaseMock, "me", "other");
    expect(score).toBeGreaterThan(0);
  });

  it("returns default 50 when profiles missing", async () => {
    supabaseMock.from.mockReturnValueOnce(profileChain(null));
    vi.mocked(fetchPublicProfile).mockResolvedValue(null);

    await expect(getQuickMatchScore(supabaseMock, "me", "other")).resolves.toBe(50);
  });

  it("returns default 50 on error", async () => {
    supabaseMock.from.mockImplementation(() => {
      throw new Error("db down");
    });

    await expect(getQuickMatchScore(supabaseMock, "me", "other")).resolves.toBe(50);
  });

  it("handles missing language list data", async () => {
    supabaseMock.from
      .mockReturnValueOnce(
        profileChain({
          user_id: "me",
          country: "India",
          preferred_language: "Hindi",
        }),
      )
      .mockReturnValueOnce(langsChain(null))
      .mockReturnValueOnce(langsChain(undefined));

    vi.mocked(fetchPublicProfile).mockResolvedValue({
      user_id: "other",
      country: "India",
      preferred_language: "Hindi",
    } as Awaited<ReturnType<typeof fetchPublicProfile>>);

    const score = await getQuickMatchScore(supabaseMock, "me", "other");
    expect(score).toBeGreaterThan(0);
  });
});
