/**
 * Men wallet gate: zero / near-zero balance blocks paid engagement tabs.
 */
export const MEN_PAID_TABS = ["chats", "groups", "matches"] as const;
export type MenPaidTabId = (typeof MEN_PAID_TABS)[number];

/** Need ~2 minutes of 1:1 chat credit; treats true zero and near-zero the same. */
export function menRechargeThreshold(chatRatePerMinute: number): number {
  const rate = Number.isFinite(chatRatePerMinute) && chatRatePerMinute > 0 ? chatRatePerMinute : 4;
  return rate * 2;
}

export function menNeedsRecharge(balance: number, chatRatePerMinute: number): boolean {
  return balance < menRechargeThreshold(chatRatePerMinute);
}

export function isMenPaidTab(tabId: string): tabId is MenPaidTabId {
  return (MEN_PAID_TABS as readonly string[]).includes(tabId);
}
