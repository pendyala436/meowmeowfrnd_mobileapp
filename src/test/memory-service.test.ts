import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractMemoriesFromText,
  containsSensitiveInfo,
  isTrivialMessage,
  detectMemoryCommand,
  getActiveMemoriesForUser,
  saveOrUpdateMemory,
  forgetMemories,
  handleMemoryCommandIfPresent,
} from "../../scripts/ai-worker/memory-service";

describe("memory-service", () => {
  describe("sensitive information filtering", () => {
    it("detects passwords and auth tokens", () => {
      expect(containsSensitiveInfo("My password is secret123")).toBe(true);
      expect(containsSensitiveInfo("My bank pin is 9988")).toBe(true);
      expect(containsSensitiveInfo("Here is my OTP 482910")).toBe(true);
    });

    it("detects financial and card numbers", () => {
      expect(containsSensitiveInfo("Card: 4111 2222 3333 4444")).toBe(true);
      expect(containsSensitiveInfo("Send money to my UPI id")).toBe(true);
      expect(containsSensitiveInfo("My aadhar number is 123456789012")).toBe(true);
    });

    it("detects sensitive medical or diagnosis terms", () => {
      expect(containsSensitiveInfo("I started chemotherapy yesterday")).toBe(true);
      expect(containsSensitiveInfo("Taking my prescribed medicine for bipolar disorder")).toBe(true);
    });

    it("allows non-sensitive personal conversation", () => {
      expect(containsSensitiveInfo("I love playing acoustic guitar in the evening")).toBe(false);
      expect(containsSensitiveInfo("I work as a UI designer in Pune")).toBe(false);
      expect(containsSensitiveInfo("I prefer speaking in Telugu")).toBe(false);
    });
  });

  describe("trivial messages", () => {
    it("identifies greetings and short generic texts as trivial", () => {
      expect(isTrivialMessage("hi")).toBe(true);
      expect(isTrivialMessage("hello!")).toBe(true);
      expect(isTrivialMessage("ok cool")).toBe(true);
      expect(isTrivialMessage("kya kar rahi ho?")).toBe(true);
    });

    it("does not classify substantive messages as trivial", () => {
      expect(isTrivialMessage("I work as a software engineer")).toBe(false);
      expect(isTrivialMessage("I love listening to old Bollywood songs")).toBe(false);
    });
  });

  describe("memory command detection", () => {
    it("detects recall queries", () => {
      expect(detectMemoryCommand("What do you remember about me?")).toEqual({ type: "recall" });
      expect(detectMemoryCommand("what do you know about me")).toEqual({ type: "recall" });
    });

    it("detects forget requests", () => {
      expect(detectMemoryCommand("Forget what I told you about my job")).toEqual({
        type: "forget",
        target: "my job",
      });
      expect(detectMemoryCommand("forget my language preference")).toEqual({
        type: "forget",
        target: "language preference",
      });
    });

    it("detects do not remember requests", () => {
      expect(detectMemoryCommand("Don't remember this conversation")).toEqual({
        type: "do_not_remember",
      });
      expect(detectMemoryCommand("please don't remember this")).toEqual({
        type: "do_not_remember",
      });
    });

    it("detects explicit remember requests", () => {
      expect(detectMemoryCommand("Remember that I love acoustic guitar")).toEqual({
        type: "remember",
        target: "I love acoustic guitar",
      });
    });
  });

  describe("memory extraction from text", () => {
    it("extracts language preferences", () => {
      const items = extractMemoriesFromText("I prefer speaking in Hindi");
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].category).toBe("preference");
      expect(items[0].content).toContain("Hindi");
    });

    it("extracts hobbies and interests", () => {
      const items = extractMemoriesFromText("I love listening to acoustic guitar and indie folk music");
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].category).toBe("interest");
      expect(items[0].content).toContain("acoustic guitar");
    });

    it("extracts occupation and location", () => {
      const items1 = extractMemoriesFromText("I work as a graphic designer in Mumbai");
      expect(items1.some((m) => m.content.includes("graphic designer"))).toBe(true);

      const items2 = extractMemoriesFromText("I live in Bengaluru");
      expect(items2.some((m) => m.content.includes("Bengaluru"))).toBe(true);
    });

    it("extracts preferred names", () => {
      const items = extractMemoriesFromText("You can call me Rahul");
      expect(items.some((m) => m.content.includes("Rahul"))).toBe(true);
    });

    it("refuses to extract sensitive or secret info", () => {
      const items = extractMemoriesFromText("My password is supersecret123 and I love guitar");
      expect(items).toEqual([]);
    });
  });

  describe("database memory storage and retrieval", () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn(),
      };
    });

    it("queries active memories strictly isolated by user_id and ai_profile_id", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "mem-1",
                        user_id: "user-1",
                        ai_profile_id: "ai-1",
                        memory_content: "User enjoys filter coffee",
                        memory_category: "interest",
                        importance: 3,
                        confidence: 0.9,
                        is_active: true,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const memories = await getActiveMemoriesForUser(mockSupabase, "user-1", "ai-1");
      expect(memories.length).toBe(1);
      expect(memories[0].memory_content).toBe("User enjoys filter coffee");
    });

    it("executes recall command returning friendly summary", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        { memory_content: "User enjoys acoustic guitar" },
                        { memory_content: "User prefers communicating in Hindi" },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await handleMemoryCommandIfPresent(
        mockSupabase,
        "user-1",
        "ai-1",
        "Priya",
        "What do you remember about me?",
      );

      expect(res.handled).toBe(true);
      expect(res.type).toBe("recall");
      expect(res.replyText).toContain("acoustic guitar");
      expect(res.replyText).toContain("Hindi");
    });

    it("executes forget command and deactivates matching memories", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "mem-1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const res = await handleMemoryCommandIfPresent(
        mockSupabase,
        "user-1",
        "ai-1",
        "Priya",
        "Forget what I told you about my job",
      );

      expect(res.handled).toBe(true);
      expect(res.type).toBe("forget");
      expect(res.replyText).toContain("removed that from my memories");
    });
  });
});
