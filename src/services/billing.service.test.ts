import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import {
  fetchUnifiedPricing,
  billMinute,
  billChatMinute,
  billAudioCallMinute,
  billVideoCallMinute,
  billGroupCallMinute,
  billFinalPartialMinute,
  sendGift,
  sendTip,
  getManBalance,
  getWomanBalance,
  listStatements,
  updatePayout,
  runMonthlyClosing,
  generatePayoutSnapshotNow,
  PRICING_DEFAULTS,
  minimumBalanceFor,
  MIN_BILLABLE_SECONDS,
} from "./billing.service";

describe("billing.service", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("constants", () => {
    it("exports MIN_BILLABLE_SECONDS", () => {
      expect(MIN_BILLABLE_SECONDS).toBe(30);
    });
  });

  describe("fetchUnifiedPricing", () => {
    it("returns PRICING_DEFAULTS when RPC fails", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(fetchUnifiedPricing()).resolves.toEqual(PRICING_DEFAULTS);
    });

    it("returns PRICING_DEFAULTS when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      await expect(fetchUnifiedPricing()).resolves.toEqual(PRICING_DEFAULTS);
    });

    it("returns RPC data when successful", async () => {
      const custom = { ...PRICING_DEFAULTS, chat_man_rate: 10 };
      rpcMock.mockResolvedValue({ data: custom, error: null });
      await expect(fetchUnifiedPricing()).resolves.toEqual(custom);
    });

    it("calls get_unified_pricing RPC", async () => {
      rpcMock.mockResolvedValue({ data: PRICING_DEFAULTS, error: null });
      await fetchUnifiedPricing();
      expect(rpcMock).toHaveBeenCalledWith("get_unified_pricing");
    });
  });

  describe("minimumBalanceFor", () => {
    it("returns double the man rate for each session type", () => {
      expect(minimumBalanceFor("chat", PRICING_DEFAULTS)).toBe(PRICING_DEFAULTS.chat_man_rate * 2);
      expect(minimumBalanceFor("audio_call", PRICING_DEFAULTS)).toBe(
        PRICING_DEFAULTS.audio_man_rate * 2,
      );
      expect(minimumBalanceFor("video_call", PRICING_DEFAULTS)).toBe(
        PRICING_DEFAULTS.video_man_rate * 2,
      );
      expect(minimumBalanceFor("private_group_call", PRICING_DEFAULTS)).toBe(
        PRICING_DEFAULTS.group_man_rate * 2,
      );
    });
  });

  describe("billMinute", () => {
    it("returns error when RPC fails", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "rpc fail" } });
      const result = await billMinute("s1", "chat", 1, "m1", "w1");
      expect(result).toEqual({ success: false, error: "rpc fail" });
    });

    it("parses string JSON response", async () => {
      rpcMock.mockResolvedValue({
        data: JSON.stringify({ success: true, charged: 4 }),
        error: null,
      });
      const result = await billMinute("s1", "chat", 1, "m1", "w1", 1, 0);
      expect(result.success).toBe(true);
      expect(result.charged).toBe(4);
    });

    it("returns error when response is empty", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      const result = await billMinute("s1", "chat", 1, "m1", "w1");
      expect(result).toEqual({ success: false, error: "No response" });
    });

    it("passes through skipped host_not_live without logging rejection", async () => {
      rpcMock.mockResolvedValue({
        data: { success: false, skipped: "host_not_live" },
        error: null,
      });
      const result = await billMinute("s1", "private_group_call", 1, "m1", "w1");
      expect(result.skipped).toBe("host_not_live");
    });

    it("passes through skipped waiting_for_replies", async () => {
      rpcMock.mockResolvedValue({
        data: { success: false, skipped: "waiting_for_replies" },
        error: null,
      });
      const result = await billMinute("s1", "chat", 1, "m1", "w1");
      expect(result.skipped).toBe("waiting_for_replies");
    });

    it("passes through skipped not_answered", async () => {
      rpcMock.mockResolvedValue({
        data: { success: false, skipped: "not_answered" },
        error: null,
      });
      const result = await billMinute("s1", "audio_call", 1, "m1", "w1");
      expect(result.skipped).toBe("not_answered");
    });

    it("logs rejection for other failures", async () => {
      rpcMock.mockResolvedValue({
        data: { success: false, error: "insufficient balance" },
        error: null,
      });
      const result = await billMinute("s1", "chat", 1, "m1", "w1");
      expect(result.success).toBe(false);
    });
  });

  describe("session-type wrappers", () => {
    it("billChatMinute uses chat type", async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      await billChatMinute("s1", 1, "m1", "w1", 2);
      expect(rpcMock).toHaveBeenCalledWith(
        "bill_session_minute",
        expect.objectContaining({
          p_session_type: "chat",
          p_minute_index: 2,
        }),
      );
    });

    it("billAudioCallMinute uses audio_call type", async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      await billAudioCallMinute("s1", 1, "m1", "w1");
      expect(rpcMock).toHaveBeenCalledWith(
        "bill_session_minute",
        expect.objectContaining({
          p_session_type: "audio_call",
        }),
      );
    });

    it("billVideoCallMinute uses video_call type", async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      await billVideoCallMinute("s1", 1, "m1", "w1");
      expect(rpcMock).toHaveBeenCalledWith(
        "bill_session_minute",
        expect.objectContaining({
          p_session_type: "video_call",
        }),
      );
    });

    it("billGroupCallMinute uses private_group_call type", async () => {
      rpcMock.mockResolvedValue({
        data: { success: true, charged: 4 },
        error: null,
      });
      const result = await billGroupCallMinute("sess-1", 1, "man-1", "woman-1", 0);
      expect(rpcMock).toHaveBeenCalledWith("bill_session_minute", {
        p_session_id: "sess-1",
        p_session_type: "private_group_call",
        p_minutes: 1,
        p_man_id: "man-1",
        p_woman_id: "woman-1",
        p_man_count: 1,
        p_minute_index: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("billFinalPartialMinute", () => {
    it("returns null when elapsed is zero", async () => {
      await expect(billFinalPartialMinute("s1", "chat", 0, "m1", "w1")).resolves.toBeNull();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("returns null when exactly on minute boundary with prior billing", async () => {
      await expect(billFinalPartialMinute("s1", "chat", 60, "m1", "w1")).resolves.toBeNull();
    });

    it("bills one minute for partial elapsed time", async () => {
      rpcMock.mockResolvedValue({ data: { success: true, charged: 4 }, error: null });
      const result = await billFinalPartialMinute("s1", "chat", 61, "m1", "w1");
      expect(result?.success).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith(
        "bill_session_minute",
        expect.objectContaining({
          p_minutes: 1.0,
          p_minute_index: 1,
        }),
      );
    });

    it("bills first minute for short sessions", async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      await billFinalPartialMinute("s1", "video_call", 5, "m1", "w1");
      expect(rpcMock).toHaveBeenCalledWith(
        "bill_session_minute",
        expect.objectContaining({
          p_minute_index: 0,
        }),
      );
    });
  });

  describe("sendGift", () => {
    it("returns success from RPC", async () => {
      rpcMock.mockResolvedValue({
        data: { success: true, charged: 100, woman_credit: 50 },
        error: null,
      });
      const result = await sendGift("m1", "w1", 100, "Rose", "ref-1");
      expect(rpcMock).toHaveBeenCalledWith("bill_gift_or_tip", {
        p_man_id: "m1",
        p_woman_id: "w1",
        p_amount: 100,
        p_type: "gift",
        p_description: "Rose",
        p_reference_id: "ref-1",
      });
      expect(result.success).toBe(true);
    });

    it("returns error when RPC fails", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "low balance" } });
      const result = await sendGift("m1", "w1", 50);
      expect(result).toEqual({ success: false, error: "low balance" });
    });

    it("returns no response error when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      const result = await sendGift("m1", "w1", 50);
      expect(result).toEqual({ success: false, error: "No response" });
    });
  });

  describe("sendTip", () => {
    it("returns success from RPC", async () => {
      rpcMock.mockResolvedValue({
        data: { success: true, type: "tip", charged: 20 },
        error: null,
      });
      const result = await sendTip("m1", "w1", 20, "Thanks");
      expect(rpcMock).toHaveBeenCalledWith("bill_gift_or_tip", {
        p_man_id: "m1",
        p_woman_id: "w1",
        p_amount: 20,
        p_type: "tip",
        p_description: "Thanks",
      });
      expect(result.success).toBe(true);
    });

    it("returns error when RPC fails", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
      expect(await sendTip("m1", "w1", 10)).toEqual({ success: false, error: "fail" });
    });

    it("returns no response when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      expect(await sendTip("m1", "w1", 10)).toEqual({ success: false, error: "No response" });
    });
  });

  describe("getManBalance", () => {
    it("returns zero when no data", async () => {
      rpcMock.mockResolvedValue({ data: null });
      expect(await getManBalance("u1")).toBe(0);
    });

    it("returns numeric balance", async () => {
      rpcMock.mockResolvedValue({ data: { balance: 150, currency: "INR" } });
      expect(await getManBalance("u1")).toBe(150);
    });

    it("returns zero when balance is not numeric", async () => {
      rpcMock.mockResolvedValue({ data: { balance: "invalid" } });
      expect(await getManBalance("u1")).toBe(0);
    });
  });

  describe("getWomanBalance", () => {
    it("returns defaults when no data", async () => {
      rpcMock.mockResolvedValue({ data: null });
      expect(await getWomanBalance("u1")).toEqual({
        available_balance: 0,
        total_earned: 0,
        paid_out: 0,
        today_earnings: 0,
        currency: "INR",
      });
    });

    it("returns RPC data", async () => {
      const balance = {
        available_balance: 500,
        total_earned: 1000,
        paid_out: 500,
        today_earnings: 50,
        currency: "INR",
      };
      rpcMock.mockResolvedValue({ data: balance });
      expect(await getWomanBalance("u1")).toEqual(balance);
    });
  });

  describe("listStatements", () => {
    it("returns empty array on error", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
      expect(await listStatements()).toEqual([]);
    });

    it("passes filters and returns rows", async () => {
      const rows = [{ statement_id: "st-1" }];
      rpcMock.mockResolvedValue({ data: rows, error: null });
      const result = await listStatements({
        gender: "female",
        year: 2025,
        month: 3,
        payoutStatus: "pending",
        userId: "u1",
        limit: 10,
        offset: 5,
      });
      expect(rpcMock).toHaveBeenCalledWith("admin_list_statements", {
        p_gender: "female",
        p_year: 2025,
        p_month: 3,
        p_payout_status: "pending",
        p_user_id: "u1",
        p_limit: 10,
        p_offset: 5,
      });
      expect(result).toEqual(rows);
    });
  });

  describe("updatePayout", () => {
    it("returns error on RPC failure", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
      expect(await updatePayout("st-1", { status: "approved" })).toEqual({
        success: false,
        error: "denied",
      });
    });

    it("returns success from RPC", async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      const result = await updatePayout("st-1", {
        status: "paid",
        pdfUrl: "https://x.com/a.pdf",
        excelUrl: "https://x.com/a.xlsx",
        notes: "done",
      });
      expect(rpcMock).toHaveBeenCalledWith("admin_update_payout", {
        p_statement_id: "st-1",
        p_status: "paid",
        p_pdf_url: "https://x.com/a.pdf",
        p_excel_url: "https://x.com/a.xlsx",
        p_notes: "done",
      });
      expect(result.success).toBe(true);
    });

    it("defaults to success when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      expect(await updatePayout("st-1", {})).toEqual({ success: true });
    });
  });

  describe("runMonthlyClosing", () => {
    it("returns error on failure", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
      expect(await runMonthlyClosing()).toEqual({ success: false, error: "boom" });
    });

    it("returns RPC result", async () => {
      rpcMock.mockResolvedValue({ data: { success: true, count: 5 }, error: null });
      expect(await runMonthlyClosing(2025, 8)).toEqual({ success: true, count: 5 });
    });
  });

  describe("generatePayoutSnapshotNow", () => {
    it("returns error on failure", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
      expect(await generatePayoutSnapshotNow()).toEqual({ success: false, error: "fail" });
    });

    it("returns snapshot count", async () => {
      rpcMock.mockResolvedValue({ data: { success: true, count: 12 }, error: null });
      expect(await generatePayoutSnapshotNow()).toEqual({ success: true, count: 12 });
    });
  });
});
