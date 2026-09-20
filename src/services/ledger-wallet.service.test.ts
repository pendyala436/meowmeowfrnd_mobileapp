import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  getMenBalance,
  getWomenBalance,
  rechargeWallet,
  getStatement,
  generatePayoutSnapshot,
  getPayoutSnapshots,
  fetchChatPricing,
} from "./ledger-wallet.service";

describe("ledger-wallet.service", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getMenBalance", () => {
    it("returns zero when no data", async () => {
      rpcMock.mockResolvedValue({ data: null });
      expect(await getMenBalance("u1")).toBe(0);
    });

    it("returns numeric balance", async () => {
      rpcMock.mockResolvedValue({ data: { balance: 250 } });
      expect(await getMenBalance("u1")).toBe(250);
    });

    it("returns zero when balance is invalid", async () => {
      rpcMock.mockResolvedValue({ data: { balance: NaN } });
      expect(await getMenBalance("u1")).toBe(0);
    });
  });

  describe("getWomenBalance", () => {
    it("returns defaults when no data", async () => {
      rpcMock.mockResolvedValue({ data: null });
      expect(await getWomenBalance("u1")).toEqual({ balance: 0, todayEarnings: 0 });
    });

    it("returns balance and today earnings", async () => {
      rpcMock.mockResolvedValue({
        data: { available_balance: 100, today_earnings: 15 },
      });
      expect(await getWomenBalance("u1")).toEqual({ balance: 100, todayEarnings: 15 });
    });

    it("coerces invalid numeric fields to zero", async () => {
      rpcMock.mockResolvedValue({ data: { available_balance: null, today_earnings: undefined } });
      expect(await getWomenBalance("u1")).toEqual({ balance: 0, todayEarnings: 0 });
    });
  });

  describe("rechargeWallet", () => {
    it("returns success from RPC", async () => {
      rpcMock.mockResolvedValue({
        data: { success: true, charged: 500 },
        error: null,
      });
      const result = await rechargeWallet("u1", 500, "ref-1", "razorpay");
      expect(rpcMock).toHaveBeenCalledWith("ledger_recharge", {
        p_user_id: "u1",
        p_amount: 500,
        p_reference_id: "ref-1",
        p_gateway: "razorpay",
      });
      expect(result.success).toBe(true);
    });

    it("returns error when RPC fails", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
      expect(await rechargeWallet("u1", 100, "r", "g")).toEqual({
        success: false,
        error: "fail",
      });
    });

    it("returns no response when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      expect(await rechargeWallet("u1", 100, "r", "g")).toEqual({
        success: false,
        error: "No response",
      });
    });
  });

  describe("getStatement", () => {
    it("returns rows from RPC", async () => {
      const rows = [{ id: "s1", debit: 4, credit: 0 }];
      rpcMock.mockResolvedValue({ data: rows, error: null });
      expect(await getStatement("u1", "2025-01-01", "2025-01-31")).toEqual(rows);
    });

    it("throws on RPC error", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
      await expect(getStatement("u1")).rejects.toEqual({ message: "denied" });
    });

    it("returns empty array when data is null", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      expect(await getStatement("u1")).toEqual([]);
    });
  });

  describe("generatePayoutSnapshot", () => {
    it("returns processed count", async () => {
      rpcMock.mockResolvedValue({
        data: { success: true, women_processed: 8, women_skipped_no_kyc: 2 },
        error: null,
      });
      expect(await generatePayoutSnapshot()).toEqual({
        success: true,
        count: 8,
        skipped: 2,
      });
    });

    it("returns error on failure", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "admin only" } });
      expect(await generatePayoutSnapshot()).toEqual({
        success: false,
        error: "admin only",
      });
    });

    it("handles missing optional counts", async () => {
      rpcMock.mockResolvedValue({ data: { success: false }, error: null });
      expect(await generatePayoutSnapshot()).toEqual({
        success: false,
        count: 0,
        skipped: 0,
      });
    });
  });

  describe("getPayoutSnapshots", () => {
    it("returns snapshots ordered by created_at", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: "p1" }], error: null }),
      };
      fromMock.mockReturnValue(chain);

      const result = await getPayoutSnapshots("2025-08");
      expect(fromMock).toHaveBeenCalledWith("women_payout_snapshots");
      expect(chain.eq).toHaveBeenCalledWith("ist_month", "2025-08");
      expect(result).toEqual([{ id: "p1" }]);
    });

    it("throws when query fails", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }),
      };
      fromMock.mockReturnValue(chain);
      await expect(getPayoutSnapshots()).rejects.toEqual({ message: "fail" });
    });

    it("returns empty array when data is null without month filter", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      fromMock.mockReturnValue(chain);
      expect(await getPayoutSnapshots()).toEqual([]);
    });
  });

  describe("fetchChatPricing", () => {
    it("returns spec defaults when no active pricing row", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      fromMock.mockReturnValue(chain);

      const pricing = await fetchChatPricing();
      expect(pricing.ratePerMinute).toBe(4);
      expect(pricing.groupCallWomenEarningRate).toBe(1);
      expect(pricing.minWithdrawalBalance).toBe(5000);
    });

    it("maps DB row to ChatPricingData", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            rate_per_minute: 5,
            women_earning_rate: 3,
            audio_rate_per_minute: 7,
            audio_women_earning_rate: 4,
            video_rate_per_minute: 9,
            video_women_earning_rate: 5,
            group_call_rate_per_minute: 6,
            group_call_women_earning_rate: 2,
            gift_women_percent: 60,
            withdrawal_fee_percent: 6,
            min_withdrawal_balance: 6000,
          },
          error: null,
        }),
      };
      fromMock.mockReturnValue(chain);

      const pricing = await fetchChatPricing();
      expect(pricing.ratePerMinute).toBe(5);
      expect(pricing.groupCallRatePerMinute).toBe(6);
      expect(pricing.giftWomenPercent).toBe(60);
    });

    it("falls back to defaults for invalid numeric fields", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            rate_per_minute: 0,
            women_earning_rate: null,
            audio_rate_per_minute: undefined,
            audio_women_earning_rate: "x",
            video_rate_per_minute: 0,
            video_women_earning_rate: 0,
            group_call_rate_per_minute: 0,
            group_call_women_earning_rate: 0,
            gift_women_percent: 0,
            withdrawal_fee_percent: 0,
            min_withdrawal_balance: 0,
          },
          error: null,
        }),
      };
      fromMock.mockReturnValue(chain);

      const pricing = await fetchChatPricing();
      expect(pricing.ratePerMinute).toBe(4);
      expect(pricing.womenEarningRate).toBe(2);
      expect(pricing.minWithdrawalBalance).toBe(5000);
    });
  });
});
