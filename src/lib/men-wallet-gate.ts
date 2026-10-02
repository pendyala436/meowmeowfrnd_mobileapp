/**
 * Men wallet gate: balance under ₹4 blocks paid engagement (tabs + online chat start).
 */
export const MEN_RECHARGE_MIN_BALANCE = 4;

export const MEN_PAID_TABS = ["chats", "groups", "matches"] as const;
export type MenPaidTabId = (typeof MEN_PAID_TABS)[number];

/** Fixed ₹4 floor — gate when balance is strictly less than this. */
export function menRechargeThreshold(_chatRatePerMinute?: number): number {
  return MEN_RECHARGE_MIN_BALANCE;
}

export function menNeedsRecharge(balance: number, _chatRatePerMinute?: number): boolean {
  return balance < MEN_RECHARGE_MIN_BALANCE;
}

export function isMenPaidTab(tabId: string): tabId is MenPaidTabId {
  return (MEN_PAID_TABS as readonly string[]).includes(tabId);
}
