/** Shared gift message format for chat + call overlays. */
export const GIFT_PREFIX = "__GIFT__::";

export interface ParsedGiftMessage {
  emoji: string;
  name: string;
  price: number;
  senderName: string;
}

export function formatGiftMessage(
  emoji: string,
  name: string,
  price: number,
  senderName: string,
): string {
  return `${GIFT_PREFIX}${emoji}::${name}::${price}::${senderName}`;
}

export function parseGiftMessage(text: string): ParsedGiftMessage | null {
  if (!text.startsWith(GIFT_PREFIX)) return null;
  const parts = text.slice(GIFT_PREFIX.length).split("::");
  if (parts.length < 4) return null;
  const [emoji, name, priceRaw, senderName] = parts;
  const price = Number(priceRaw);
  if (!emoji || !name || !senderName) return null;
  return { emoji, name, price: Number.isFinite(price) ? price : 0, senderName };
}

export interface AnimatedGift {
  id: string;
  emoji: string;
  name: string;
  senderName: string;
}

export function createAnimatedGift(parsed: ParsedGiftMessage): AnimatedGift {
  return {
    id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    emoji: parsed.emoji,
    name: parsed.name,
    senderName: parsed.senderName,
  };
}
