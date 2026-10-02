import { describe, it, expect } from "vitest";
import {
  MEN_PAID_TABS,
  isMenPaidTab,
  menNeedsRecharge,
  menRechargeThreshold,
} from "./men-wallet-gate";

describe("men-wallet-gate", () => {
  it("uses 2x chat rate as near-zero threshold", () => {
    expect(menRechargeThreshold(4)).toBe(8);
    expect(menRechargeThreshold(0)).toBe(8);
    expect(menRechargeThreshold(NaN)).toBe(8);
  });

  it("flags zero and near-zero balances", () => {
    expect(menNeedsRecharge(0, 4)).toBe(true);
    expect(menNeedsRecharge(7.99, 4)).toBe(true);
    expect(menNeedsRecharge(8, 4)).toBe(false);
    expect(menNeedsRecharge(100, 4)).toBe(false);
  });

  it("identifies paid engagement tabs", () => {
    expect(MEN_PAID_TABS).toEqual(["chats", "groups"]);
    expect(isMenPaidTab("chats")).toBe(true);
    expect(isMenPaidTab("groups")).toBe(true);
    expect(isMenPaidTab("matches")).toBe(false);
    expect(isMenPaidTab("online")).toBe(false);
    expect(isMenPaidTab("wallet")).toBe(false);
  });
});
