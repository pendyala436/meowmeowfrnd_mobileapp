import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  formatConversationHistory,
  type PersonaProfileData,
  type MessageRecord,
} from "../../scripts/ai-worker/prompt-builder";

describe("prompt-builder", () => {
  const persona: PersonaProfileData = {
    id: "persona-uuid-1",
    user_id: "user-ai-1",
    persona_code: "maya_ai",
    display_name: "Maya",
    system_prompt: "You are a cheerful music and art enthusiast from Mumbai.",
    primary_language: "Hindi",
    bio: "Artist and friend.",
  };

  it("builds a system prompt containing disclosure and rules", () => {
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain("Maya");
    expect(prompt).toContain("companion on Meow Meow");
    expect(prompt).toContain("NEVER speak like an automated customer service assistant");
    expect(prompt).toContain("Strictly 1 to 2 short, expressive sentences");
    expect(prompt).toContain("Your native language is Hindi");
  });

  it("prioritizes custom persona prompt override over generated defaults", () => {
    const customPrompt = "SPECIAL INSTRUCTION: Speak with poetic metaphors about rains and tea.";
    const customPersona: PersonaProfileData = {
      ...persona,
      system_prompt: customPrompt,
    };
    const prompt = buildSystemPrompt(customPersona);
    expect(prompt).toContain("SPECIAL IDENTITY & CHARACTER GUIDELINES (HIGHEST PRIORITY)");
    expect(prompt).toContain(customPrompt);
  });

  it("supports regional personas with distinct language and background", () => {
    const bengaliPersona: PersonaProfileData = {
      id: "persona-uuid-2",
      user_id: "user-ai-2",
      persona_code: "ananya_kolkata",
      display_name: "Ananya",
      system_prompt: "Passionate about Rabindra Sangeet, literature, and sweet conversations.",
      primary_language: "Bengali",
      state: "West Bengal",
      country: "India",
      bio: "Kolkata girl who loves poetry and warm tea.",
      interests: ["Rabindra Sangeet", "Poetry", "Tea"],
      model_name: "phoebe-rp:latest",
      temperature: 0.7,
      max_tokens: 60,
    };

    const prompt = buildSystemPrompt(bengaliPersona);
    expect(prompt).toContain("Ananya");
    expect(prompt).toContain("West Bengal, India");
    expect(prompt).toContain("Your native language is Bengali");
    expect(prompt).toContain("Rabindra Sangeet, Poetry, Tea");
  });

  it("configures Telugu personas to use natural Telugish and Indian English", () => {
    const teluguPersona: PersonaProfileData = {
      id: "persona-uuid-3",
      user_id: "user-ai-3",
      persona_code: "swathi_hyd",
      display_name: "Swathi",
      primary_language: "Telugu",
      city: "Hyderabad",
      state: "Telangana",
      country: "India",
      bio: "Software engineer who loves Hyderabadi biryani and filter coffee.",
      interests: ["Coffee", "Coding", "Movies"],
    };

    const prompt = buildSystemPrompt(teluguPersona);
    expect(prompt).toContain("Your native language is Telugu");
    expect(prompt).toContain("Telugish");
    expect(prompt).toContain("Hyderabad, Telangana, India");
  });

  it("instructs persona not to reintroduce itself when conversation is already ongoing", () => {
    const ongoingPrompt = buildSystemPrompt(persona, { isOngoingConversation: true });
    expect(ongoingPrompt).toContain("This conversation is already established and ongoing. DO NOT introduce yourself by name again");
    expect(ongoingPrompt).toContain("DO NOT say \"I am Maya\"");
  });

  it("dynamically generates personality for female profiles without predefined ai_personas entries", () => {
    const dynamicFemaleProfile: PersonaProfileData = {
      id: "fp-105-uuid",
      user_id: "user-female-105",
      display_name: "Pooja Sharma",
      age: 24,
      bio: "Loves classical dance, cooking authentic North Indian dishes, and evening walks.",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      primary_language: "Hindi",
      preferred_language: "Hindi",
      interests: ["Kathak", "Cooking", "Travel"],
      occupation: "Graphic Designer",
    };

    const prompt = buildSystemPrompt(dynamicFemaleProfile);
    expect(prompt).toContain("Pooja Sharma");
    expect(prompt).toContain("24-year-old");
    expect(prompt).toContain("Jaipur, Rajasthan, India");
    expect(prompt).toContain("Kathak, Cooking, Travel");
    expect(prompt).toContain("Graphic Designer");
    expect(prompt).toContain("Your native language is Hindi");
  });

  it("formats conversation history chronologically with user/assistant roles", () => {
    const aiId = "user-ai-1";
    const humanId = "user-human-2";

    const messages: MessageRecord[] = [
      {
        id: "msg-1",
        sender_id: humanId,
        receiver_id: aiId,
        message: "Hello Maya!",
        created_at: "2026-10-20T10:00:00Z",
      },
      {
        id: "msg-2",
        sender_id: aiId,
        receiver_id: humanId,
        message: "Namaste! How are you doing today?",
        created_at: "2026-10-20T10:01:00Z",
      },
      {
        id: "msg-3",
        sender_id: humanId,
        receiver_id: aiId,
        message: "I am good, listening to some songs.",
        created_at: "2026-10-20T10:02:00Z",
      },
    ];

    const history = formatConversationHistory(messages, aiId, undefined, 10);
    expect(history).toEqual([
      { role: "user", content: "Hello Maya!" },
      { role: "assistant", content: "Namaste! How are you doing today?" },
      { role: "user", content: "I am good, listening to some songs." },
    ]);
  });

  it("appends current incoming message without duplicating if already present in messages by id", () => {
    const aiId = "user-ai-1";
    const humanId = "user-human-2";

    const messages: MessageRecord[] = [
      {
        id: "msg-1",
        sender_id: humanId,
        receiver_id: aiId,
        message: "Hello Maya!",
        created_at: "2026-10-20T10:00:00Z",
      },
      {
        id: "msg-incoming",
        sender_id: humanId,
        receiver_id: aiId,
        message: "What are your plans today?",
        created_at: "2026-10-20T10:02:00Z",
      },
    ];

    const history = formatConversationHistory(
      messages,
      aiId,
      { id: "msg-incoming", text: "What are your plans today?", senderId: humanId },
      10,
    );

    // msg-incoming should appear exactly once
    expect(history.length).toBe(2);
    expect(history[0].content).toBe("Hello Maya!");
    expect(history[1].content).toBe("What are your plans today?");
  });

  it("limits history to maxHistory count preserving chronological order", () => {
    const aiId = "user-ai-1";
    const humanId = "user-human-2";
    const msgs: MessageRecord[] = Array.from({ length: 15 }, (_, i) => ({
      id: `msg-${i}`,
      sender_id: i % 2 === 0 ? humanId : aiId,
      receiver_id: i % 2 === 0 ? aiId : humanId,
      message: `Message ${i}`,
      created_at: new Date(Date.now() + i * 1000).toISOString(),
    }));

    const history = formatConversationHistory(msgs, aiId, undefined, 5);
    expect(history.length).toBe(5);
    expect(history[4].content).toBe("Message 14");
  });
});
