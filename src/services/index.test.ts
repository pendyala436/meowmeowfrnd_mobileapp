import { describe, it, expect } from "vitest";
import * as services from "./index";

describe("services/index", () => {
  it("re-exports cleanup service functions", () => {
    expect(typeof services.triggerDataCleanup).toBe("function");
    expect(typeof services.verifyPhoto).toBe("function");
    expect(typeof services.runAllCleanups).toBe("function");
  });

  it("re-exports ledger wallet functions", () => {
    expect(typeof services.getMenBalance).toBe("function");
    expect(typeof services.fetchChatPricing).toBe("function");
    expect(typeof services.rechargeWallet).toBe("function");
  });
});
