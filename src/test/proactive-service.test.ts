import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isInsideQuietHours,
  checkProactiveEligibility,
  identifyFollowUpOpportunity,
  buildProactiveSystemPrompt,
  executeProactiveJob,
  runProactiveSchedulerCycle,
  type ProactiveJob,
} from "../../scripts/ai-worker/proactive-service";

describe("proactive-service", () => {
  describe("quiet hours check", () => {
    it("correctly identifies hours inside overnight quiet period (22 to 8)", () => {
      expect(isInsideQuietHours(22, 22, 8)).toBe(true);
      expect(isInsideQuietHours(23, 22, 8)).toBe(true);
      expect(isInsideQuietHours(0, 22, 8)).toBe(true);
      expect(isInsideQuietHours(4, 22, 8)).toBe(true);
      expect(isInsideQuietHours(7, 22, 8)).toBe(true);
    });

    it("correctly identifies hours outside quiet period", () => {
      expect(isInsideQuietHours(8, 22, 8)).toBe(false);
      expect(isInsideQuietHours(12, 22, 8)).toBe(false);
      expect(isInsideQuietHours(17, 22, 8)).toBe(false);
      expect(isInsideQuietHours(21, 22, 8)).toBe(false);
    });
  });

  describe("eligibility and consent", () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn(),
      };
    });

    it("rejects proactive messaging if user has not explicitly opted in", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: "user-1", proactive_enabled: false },
            }),
          }),
        }),
      });

      const res = await checkProactiveEligibility(mockSupabase, "user-1", "ai-1");
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("not enabled");
    });

    it("rejects proactive messaging if default user has no row", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      });

      const res = await checkProactiveEligibility(mockSupabase, "user-new", "ai-1");
      expect(res.eligible).toBe(false);
    });

    it("rejects if inside quiet hours even when proactive is enabled", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                user_id: "user-1",
                proactive_enabled: true,
                quiet_hours_start: 22,
                quiet_hours_end: 8,
              },
            }),
          }),
        }),
      });

      const lateNight = new Date("2026-11-08T23:30:00");
      const res = await checkProactiveEligibility(mockSupabase, "user-1", "ai-1", lateNight);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain("quiet hours");
    });
  });

  describe("opportunity identification", () => {
    it("disqualifies follow-up if conversation was updated less than 12 hours ago", () => {
      const res = identifyFollowUpOpportunity("I like songs", 4, []);
      expect(res.shouldFollowUp).toBe(false);
      expect(res.reason).toContain("too fresh");
    });

    it("disqualifies follow-up if conversation has been idle for more than 14 days", () => {
      const res = identifyFollowUpOpportunity("I like songs", 400, []);
      expect(res.shouldFollowUp).toBe(false);
      expect(res.reason).toContain("too old");
    });

    it("identifies upcoming exam or interview from recent message", () => {
      const res = identifyFollowUpOpportunity("I have a big interview tomorrow morning", 24, []);
      expect(res.shouldFollowUp).toBe(true);
      expect(res.topicSummary).toContain("interview");
    });

    it("identifies active user memory as a follow-up opportunity", () => {
      const memories: any[] = [
        {
          id: "mem-1",
          is_active: true,
          memory_category: "interest",
          memory_content: "User loves acoustic guitar and songwriting",
        },
      ];
      const res = identifyFollowUpOpportunity("Had a good day", 30, memories);
      expect(res.shouldFollowUp).toBe(true);
      expect(res.topicSummary).toContain("acoustic guitar");
    });
  });

  describe("proactive prompt construction", () => {
    it("strictly forbids manipulative and desperate language", () => {
      const prompt = buildProactiveSystemPrompt("Priya", "Hindi", "Follow up on guitar");
      expect(prompt).toContain("Priya");
      expect(prompt).toContain("NEVER sound desperate, guilty, or needy");
      expect(prompt).toContain("Where are you?");
      expect(prompt).toContain("strictly 1 to 2 sentences");
    });
  });

  describe("proactive job execution & deduplication", () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn(),
      };
    });

    it("skips job if user already sent a subsequent message in the conversation", async () => {
      const job: ProactiveJob = {
        id: "job-1",
        chat_id: "chat-1",
        user_id: "user-1",
        ai_profile_id: "ai-1",
        topic_summary: "Ask about guitar",
        scheduled_for: new Date(Date.now() - 5000).toISOString(),
        status: "pending",
        retry_count: 0,
      };

      (job as any).created_at = new Date(Date.now() - 10000).toISOString();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "ai_proactive_jobs") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [{ id: "job-1" }] }),
                }),
              }),
            }),
          };
        }
        if (table === "chat_messages") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    // User already replied after job creation!
                    data: [
                      {
                        id: "msg-recent",
                        sender_id: "user-1",
                        created_at: new Date(Date.now()).toISOString(),
                      },
                    ],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "female_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === "ai_personas") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await executeProactiveJob(mockSupabase, job);
      expect(res.success).toBe(false);
      expect(res.reason).toContain("already sent a message");
    });
  });
});
