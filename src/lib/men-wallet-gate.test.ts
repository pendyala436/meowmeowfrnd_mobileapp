import { describe, it, expect } from "vitest";
import {
  MEN_PAID_TABS,
  MEN_RECHARGE_MIN_BALANCE,
  isMenPaidTab,
  menNeedsRecharge,
  menRechargeThreshold,
} from "./men-wallet-gate";

describe("men-wallet-gate", () => {
  it("uses a fixed ₹4 threshold", () => {
    expect(MEN_RECHARGE_MIN_BALANCE).toBe(4);
    expect(menRechargeThreshold(4)).toBe(4);
    expect(menRechargeThreshold(0)).toBe(4);
    expect(menRechargeThreshold()).toBe(4);
  });

  it("flags balance strictly less than ₹4", () => {
    expect(menNeedsRecharge(0)).toBe(true);
    expect(menNeedsRecharge(3.99)).toBe(true);
    expect(menNeedsRecharge(4)).toBe(false);
    expect(menNeedsRecharge(100)).toBe(false);
  });

  it("identifies paid engagement tabs including matches", () => {
    expect(MEN_PAID_TABS).toEqual(["chats", "groups", "matches"]);
    expect(isMenPaidTab("chats")).toBe(true);
    expect(isMenPaidTab("groups")).toBe(true);
    expect(isMenPaidTab("matches")).toBe(true);
    expect(isMenPaidTab("online")).toBe(false);
    expect(isMenPaidTab("wallet")).toBe(false);
  });
});
