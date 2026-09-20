import { describe, expect, it } from "vitest";
import {
  GIFT_PREFIX,
  formatGiftMessage,
  parseGiftMessage,
  createAnimatedGift,
} from "./gift-message";

describe("formatGiftMessage", () => {
  it("builds a prefixed gift payload", () => {
    expect(formatGiftMessage("🌹", "Rose", 50, "Ada")).toBe(`${GIFT_PREFIX}🌹::Rose::50::Ada`);
  });
});

describe("parseGiftMessage", () => {
  it("returns null for non-gift text", () => {
    expect(parseGiftMessage("hello")).toBeNull();
  });

  it("returns null when parts are incomplete", () => {
    expect(parseGiftMessage(`${GIFT_PREFIX}🌹::Rose`)).toBeNull();
  });

  it("returns null when required fields are empty", () => {
    expect(parseGiftMessage(`${GIFT_PREFIX}::Rose::50::Ada`)).toBeNull();
    expect(parseGiftMessage(`${GIFT_PREFIX}🌹::::50::Ada`)).toBeNull();
    expect(parseGiftMessage(`${GIFT_PREFIX}🌹::Rose::50::`)).toBeNull();
  });

  it("parses a valid gift message", () => {
    expect(parseGiftMessage(formatGiftMessage("🎁", "Gift", 100, "Bob"))).toEqual({
      emoji: "🎁",
      name: "Gift",
      price: 100,
      senderName: "Bob",
    });
  });

  it("uses 0 for non-finite price", () => {
    expect(parseGiftMessage(`${GIFT_PREFIX}🎁::Gift::NaN::Bob`)).toEqual({
      emoji: "🎁",
      name: "Gift",
      price: 0,
      senderName: "Bob",
    });
  });
});

describe("createAnimatedGift", () => {
  it("maps parsed gift fields onto an animated gift", () => {
    const animated = createAnimatedGift({
      emoji: "💎",
      name: "Diamond",
      price: 500,
      senderName: "Cara",
    });
    expect(animated.emoji).toBe("💎");
    expect(animated.name).toBe("Diamond");
    expect(animated.senderName).toBe("Cara");
    expect(animated.id).toMatch(/^gift-/);
  });
});
