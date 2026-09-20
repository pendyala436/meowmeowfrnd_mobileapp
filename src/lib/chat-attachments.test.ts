import { describe, it, expect } from "vitest";
import {
  normalizeChatAttachmentUrl,
  extractVoiceUrl,
  storagePathFromAttachmentUrl,
  isMediaChatMessage,
  isTranslatableChatText,
} from "./chat-attachments";

describe("normalizeChatAttachmentUrl", () => {
  it("returns null for empty input", () => {
    expect(normalizeChatAttachmentUrl(null)).toBeNull();
    expect(normalizeChatAttachmentUrl("")).toBeNull();
    expect(normalizeChatAttachmentUrl("   ")).toBeNull();
  });

  it("strips duplicate chat-attachment:// prefixes", () => {
    expect(normalizeChatAttachmentUrl("chat-attachment://chat-attachment://path/file.mp3"))
      .toBe("chat-attachment://path/file.mp3");
  });

  it("preserves https URLs", () => {
    expect(normalizeChatAttachmentUrl("https://cdn.example.com/voice.mp3"))
      .toBe("https://cdn.example.com/voice.mp3");
  });

  it("wraps bare paths in chat-attachment scheme", () => {
    expect(normalizeChatAttachmentUrl("user123/voice.webm"))
      .toBe("chat-attachment://user123/voice.webm");
  });
});

describe("extractVoiceUrl", () => {
  it("extracts [VOICE: ...] marker", () => {
    expect(extractVoiceUrl("[VOICE: user/voice.mp3]"))
      .toBe("chat-attachment://user/voice.mp3");
  });

  it("extracts emoji voice marker", () => {
    expect(extractVoiceUrl("🎤 voice: nested/path.webm"))
      .toBe("chat-attachment://nested/path.webm");
  });

  it("returns null when no voice marker", () => {
    expect(extractVoiceUrl("Hello world")).toBeNull();
  });
});

describe("storagePathFromAttachmentUrl", () => {
  it("removes chat-attachment scheme", () => {
    expect(storagePathFromAttachmentUrl("chat-attachment://user/file.mp3"))
      .toBe("user/file.mp3");
  });

  it("removes multiple stacked schemes", () => {
    expect(storagePathFromAttachmentUrl("chat-attachment://chat-attachment://a/b"))
      .toBe("a/b");
  });
});

describe("isMediaChatMessage", () => {
  it("returns false for empty messages", () => {
    expect(isMediaChatMessage(null)).toBe(false);
    expect(isMediaChatMessage("")).toBe(false);
    expect(isMediaChatMessage("   ")).toBe(false);
  });

  it("detects voice markers", () => {
    expect(isMediaChatMessage("[VOICE: x]")).toBe(true);
    expect(isMediaChatMessage("🎤 voice: x")).toBe(true);
    expect(isMediaChatMessage("🎤 hello")).toBe(true);
  });

  it("detects attachment and media markers", () => {
    expect(isMediaChatMessage("[attachment: file.pdf]")).toBe(true);
    expect(isMediaChatMessage("chat-attachment://x")).toBe(true);
    expect(isMediaChatMessage("[IMAGE: pic.jpg]")).toBe(true);
    expect(isMediaChatMessage("[VIDEO: clip.mp4]")).toBe(true);
    expect(isMediaChatMessage("[DOCUMENT: doc.pdf]")).toBe(true);
    expect(isMediaChatMessage("📷 Photo")).toBe(true);
    expect(isMediaChatMessage("🎬 Video")).toBe(true);
    expect(isMediaChatMessage("📎 File")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isMediaChatMessage("How are you?")).toBe(false);
  });
});

describe("isTranslatableChatText", () => {
  it("returns false for empty text", () => {
    expect(isTranslatableChatText(null)).toBe(false);
    expect(isTranslatableChatText("  ")).toBe(false);
  });

  it("returns true for plain text messages", () => {
    expect(isTranslatableChatText("Namaste!")).toBe(true);
  });

  it("returns false for media messages", () => {
    expect(isTranslatableChatText("[VOICE: x]")).toBe(false);
    expect(isTranslatableChatText("📷 sent a photo")).toBe(false);
  });
});
