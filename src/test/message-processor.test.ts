import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processIncomingAiMessage,
  getActivePersonaForUser,
  claimMessageJob,
} from "../../scripts/ai-worker/message-processor";

describe("message-processor", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      channel: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
          cb("SUBSCRIBED");
          return {};
        }),
        send: vi.fn().mockResolvedValue({}),
      }),
      removeChannel: vi.fn().mockResolvedValue({}),
    };
  });

  it("skips message if sender is same as receiver (prevent self-loop)", async () => {
    const res = await processIncomingAiMessage({
      messageId: "msg-1",
      chatId: "chat-1",
      senderId: "user-ai",
      receiverId: "user-ai",
      messageText: "Hello self",
      supabase: mockSupabase,
    });

    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("Sender is same as receiver");
  });

  it("skips message if receiver is a normal human female profile (is_ai_managed = false)", async () => {
    // Mock female_profiles query returning a human profile (is_ai_managed: false)
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "female_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "fp-human-1",
                  user_id: "user-human-female",
                  full_name: "Sneha",
                  is_ai_managed: false, // HUMAN ACCOUNT
                  approval_status: "approved",
                  account_status: "active",
                },
                error: null,
              }),
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

    const res = await processIncomingAiMessage({
      messageId: "msg-1",
      chatId: "chat-1",
      senderId: "user-human-male",
      receiverId: "user-human-female",
      messageText: "Hi Sneha!",
      supabase: mockSupabase,
    });

    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("Receiver is not an active AI persona");
  });

  it("dynamically resolves an eligible AI-managed female profile outside the 100 personas", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "female_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "fp-250-uuid",
                  user_id: "user-female-250",
                  full_name: "Rhea Sen",
                  age: 23,
                  bio: "Love mountains and coffee",
                  state: "Himachal Pradesh",
                  country: "India",
                  primary_language: "Hindi",
                  interests: ["Trekking", "Coffee"],
                  is_ai_managed: true, // Marked as AI-managed
                  approval_status: "approved",
                  account_status: "active",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "ai_personas") {
        // No custom override in ai_personas - purely dynamic!
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

    const persona = await getActivePersonaForUser(mockSupabase, "user-female-250");
    expect(persona).not.toBeNull();
    expect(persona?.display_name).toBe("Rhea Sen");
    expect(persona?.user_id).toBe("user-female-250");
    expect(persona?.primary_language).toBe("Hindi");
    expect(persona?.interests).toEqual(["Trekking", "Coffee"]);
  });

  it("skips empty or whitespace-only messages", async () => {
    const res = await processIncomingAiMessage({
      messageId: "msg-empty",
      chatId: "chat-1",
      senderId: "user-human",
      receiverId: "user-ai",
      messageText: "   ",
      supabase: mockSupabase,
    });

    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("Message is empty or unsupported");
  });

  it("atomically claims message job in ai_message_jobs table", async () => {
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const claimed = await claimMessageJob(
      mockSupabase,
      "msg-1",
      "chat-1",
      "user-female-250",
      "user-human",
    );
    expect(claimed).toBe(true);
  });

  it("prevents duplicate reply if message job is already claimed", async () => {
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "job-1", status: "completed", retry_count: 0 },
            error: null,
          }),
        }),
      }),
    });

    const claimed = await claimMessageJob(
      mockSupabase,
      "msg-1",
      "chat-1",
      "user-female-250",
      "user-human",
    );
    expect(claimed).toBe(false);
  });
});
