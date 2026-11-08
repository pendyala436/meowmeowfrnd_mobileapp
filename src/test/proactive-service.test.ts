import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isInsideQuietHours,
  getCurrentHourInTimezone,
  checkProactiveEligibility,
  identifyFollowUpOpportunity,
  buildProactiveSystemPrompt,
  executeProactiveJob,
  runProactiveSchedulerCycle,
  runOpportunityDiscoveryCycle,
  recoverStaleProcessingJobs,
  type ProactiveJob,
} from "../../scripts/ai-worker/proactive-service.js";

describe("Proactive Service v2.6.0 Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Quiet hours and timezone calculations", () => {
    it("should correctly identify quiet hours without midnight wrap", () => {
      expect(isInsideQuietHours(14, 13, 17)).toBe(true);
      expect(isInsideQuietHours(12, 13, 17)).toBe(false);
      expect(isInsideQuietHours(18, 13, 17)).toBe(false);
    });

    it("should correctly identify quiet hours wrapping over midnight (22 to 8)", () => {
      expect(isInsideQuietHours(23, 22, 8)).toBe(true);
      expect(isInsideQuietHours(2, 22, 8)).toBe(true);
      expect(isInsideQuietHours(7, 22, 8)).toBe(true);
      expect(isInsideQuietHours(10, 22, 8)).toBe(false);
      expect(isInsideQuietHours(15, 22, 8)).toBe(false);
    });

    it("should compute hour in timezone safely", () => {
      const now = new Date("2026-11-08T04:30:00.000Z"); // 10:00 AM IST
      const hourIst = getCurrentHourInTimezone(now, "Asia/Kolkata");
      expect(hourIst).toBe(10);
    });
  });

  describe("Autonomous Opportunity Discovery & Categorization", () => {
    it("should return false if conversation was too fresh (< 12 hours)", () => {
      const res = identifyFollowUpOpportunity("I have an exam tomorrow", 5, []);
      expect(res.shouldFollowUp).toBe(false);
      expect(res.reason).toContain("fresh");
    });

    it("should return false if conversation is too stale (> 14 days)", () => {
      const res = identifyFollowUpOpportunity("I love playing guitar", 15 * 24, []);
      expect(res.shouldFollowUp).toBe(false);
      expect(res.reason).toContain("too old");
    });

    it("should categorize upcoming_event when exam/presentation mentioned for tomorrow", () => {
      const res = identifyFollowUpOpportunity(
        "I have a big presentation tomorrow morning at work",
        20,
        [],
      );
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("upcoming_event");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("should categorize event_followup when exam or interview is in past", () => {
      const res = identifyFollowUpOpportunity(
        "My job interview is at 10am",
        26,
        [],
      );
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("event_followup");
    });

    it("should categorize personal_goal from memories", () => {
      const memories = [
        {
          id: "mem-goal-1",
          user_id: "u1",
          ai_profile_id: "a1",
          memory_category: "goal" as const,
          memory_content: "Learning Spanish and aims to be fluent",
          confidence_score: 0.9,
          importance_score: 4,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const res = identifyFollowUpOpportunity(null, 30, memories);
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("personal_goal");
      expect(res.topicSummary).toContain("Spanish");
    });

    it("should categorize shared_interest from memories", () => {
      const memories = [
        {
          id: "mem-interest-1",
          user_id: "u1",
          ai_profile_id: "a1",
          memory_category: "interest" as const,
          memory_content: "Loves vintage Bollywood vinyl records",
          confidence_score: 0.85,
          importance_score: 3,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const res = identifyFollowUpOpportunity(null, 48, memories);
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("shared_interest");
    });

    it("should categorize emotional_support when user reported being stressed or exhausted", () => {
      const res = identifyFollowUpOpportunity(
        "I am so exhausted and stressed after a rough day",
        18,
        [],
      );
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("emotional_support");
    });

    it("should categorize unfinished_topic when user left an incomplete thought", () => {
      const res = identifyFollowUpOpportunity(
        "Gotta go now, let you know more about that story later!",
        24,
        [],
      );
      expect(res.shouldFollowUp).toBe(true);
      expect(res.category).toBe("unfinished_topic");
    });
  });

  describe("Consent, Preferences & Safeguards", () => {
    it("should enforce default opt-out: return eligible = false if proactive_enabled is false or missing", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      } as unknown as any;

      const res = await checkProactiveEligibility(mockSupabase, "user-optout", "ai-profile-1");
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("not enabled");
    });

    it("should respect per-profile exclusion in disabled_profile_ids list", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  proactive_enabled: true,
                  quiet_hours_start: 22,
                  quiet_hours_end: 8,
                  disabled_profile_ids: ["blocked-ai-profile-id"],
                },
              }),
            }),
          }),
        }),
      } as unknown as any;

      const res = await checkProactiveEligibility(mockSupabase, "user-1", "blocked-ai-profile-id");
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("disabled for this specific AI profile");
    });

    it("should reject proactive check if user has blocked the AI profile in user_blocks", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "ai_user_engagement_preferences") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      proactive_enabled: true,
                      quiet_hours_start: 22,
                      quiet_hours_end: 8,
                      disabled_profile_ids: [],
                    },
                  }),
                }),
              }),
            };
          }
          if (table === "ai_user_profile_engagement_preferences") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "user_blocks") {
            return {
              select: () => ({
                or: () => ({
                  limit: async () => ({ data: [{ id: "block-row-1" }] }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
        }),
      } as unknown as any;

      const res = await checkProactiveEligibility(mockSupabase, "user-1", "ai-profile-1");
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("blocked");
    });

    it("should strictly prohibit guilt, desperate, or needy phrasing in generated system prompts", () => {
      const prompt = buildProactiveSystemPrompt("Aarya", "Hindi", "Follow up on presentation", "Exam at 9am", "upcoming_event");
      expect(prompt).toContain("STRICTLY PROHIBITED");
      expect(prompt).toContain("Why didn't you reply?");
      expect(prompt).toContain("Where are you?");
      expect(prompt).toContain("Are you ignoring me?");
      expect(prompt).toContain("1 to 2 sentences");
    });
  });

  describe("Stale Processing Job Recovery", () => {
    it("should reset stale processing jobs back to pending when retries are under limit", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ id: "stale-job-1", retry_count: 1 }],
              }),
            }),
          }),
          update: updateMock,
        }),
      } as unknown as any;

      const recovered = await recoverStaleProcessingJobs(mockSupabase, 10);
      expect(recovered).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    });
  });
});
