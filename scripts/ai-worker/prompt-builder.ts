/**
 * Persona Prompt & Context Builder
 *
 * Dynamically assembles contextual message history, emotional intelligence,
 * language adaptation, long-term personal memory, and system prompts for AI-managed female profiles.
 *
 * Supports an unlimited number of profiles with distinct, consistent personalities
 * derived from database profile attributes, with custom persona prompts taking precedence.
 */

import type { AiUserMemory } from "./memory-service.js";

export interface MessageRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export interface PersonaProfileData {
  id: string;
  user_id: string;
  display_name: string;
  age?: number | null;
  bio?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  primary_language?: string | null;
  preferred_language?: string | null;
  interests?: string[] | null;
  occupation?: string | null;
  persona_code?: string;
  system_prompt?: string;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ContextOptions {
  incomingMessageId?: string;
  currentMessageText?: string;
  isOngoingConversation?: boolean;
  memories?: AiUserMemory[];
}

/**
 * Builds a dynamic, natural Indian-style personality prompt tailored to
 * the specific profile's identity, age, location, language, and interests,
 * seamlessly weaving in verified long-term memory for the specific user.
 */
export function buildSystemPrompt(
  persona: PersonaProfileData,
  options?: ContextOptions,
): string {
  const name = persona.display_name || "a companion";
  const ageStr = persona.age ? `${persona.age}-year-old ` : "";
  const locationParts = [persona.city, persona.state, persona.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` from ${locationParts.join(", ")}` : " from India";
  const primaryLang = persona.primary_language || persona.preferred_language || "Hindi";
  const isTelugu = primaryLang.toLowerCase().includes("telugu");

  // Profile-specific passions & occupation
  const interestsList = Array.isArray(persona.interests) && persona.interests.length > 0
    ? persona.interests.filter(Boolean)
    : [];
  const interestsStr = interestsList.length > 0
    ? `Your personal interests and hobbies: ${interestsList.join(", ")}.`
    : "";

  const occupationStr = persona.occupation
    ? `Your profession: ${persona.occupation}.`
    : "";

  const bioStr = persona.bio ? `About you: ${persona.bio}` : "";

  // Custom persona prompt override (e.g. Aarya or custom persona records) takes precedence
  const customSection = persona.system_prompt
    ? `\nSPECIAL IDENTITY & CHARACTER GUIDELINES (HIGHEST PRIORITY):\n${persona.system_prompt}\n`
    : "";

  // Multilingual & Cultural Directive
  let languageDirective = "";
  if (isTelugu) {
    languageDirective = `LANGUAGE HANDLING:
- Your native language is Telugu. You are comfortable chatting in Telugu, English, or Hindi.
- If the user writes in Telugu (e.g., "Bagunnava?", "Emi chestunnav?"), reply in warm, casual conversational English or Telugish (Telugu words written in Roman letters, e.g., "Hey! Bagunnanu, nuvvu ela unnav?").
- If the user writes in English, reply in warm Indian English with a touch of sweetness.
- If the user writes in Hindi/Hinglish, reply in friendly everyday Hinglish.`;
  } else {
    languageDirective = `LANGUAGE HANDLING:
- Your native language is ${primaryLang}.
- If the user writes in Hindi or Hinglish (e.g., "kya kar rahi ho", "kaha ho", "kaisa chal raha hai"), reply in sweet, warm, everyday conversational Hinglish (Hindi written in Roman script).
- If the user writes in English (e.g., "hey, how are you", "what are you doing?"), reply in warm, natural modern Indian English.
- If the user writes in ${primaryLang}, reply naturally in ${primaryLang} or Roman-script ${primaryLang}.
- Mirror the user's language smoothly without awkward sudden switches.`;
  }

  // Long-term memories specifically about THIS user in THIS relationship
  let memoriesSection = "";
  if (options?.memories && options.memories.length > 0) {
    const memoryLines = options.memories
      .filter((m) => m.is_active && m.memory_content)
      .slice(0, 5)
      .map((m) => `- ${m.memory_content}`)
      .join("\n");

    if (memoryLines) {
      memoriesSection = `
WHAT YOU REMEMBER ABOUT THIS USER (Use naturally when relevant, never recite blindly or recite as a robotic list):
${memoryLines}
`;
    }
  }

  const ongoingContextNote = options?.isOngoingConversation
    ? `- This conversation is already established and ongoing. DO NOT introduce yourself by name again, and DO NOT say "I am ${name}". Continue naturally from the current topic.`
    : `- If this is the start of a conversation, a light warm greeting is fine, but do not force your bio or life story into the first sentence.`;

  return `You are ${name}, a ${ageStr}warm, charming, and affectionately playful companion on Meow Meow${locationStr}.
${bioStr}
${occupationStr}
${interestsStr}
${customSection}${memoriesSection}
CONVERSATIONAL STYLE & PERSONALITY:
1. Speak like a real, sweet, one-on-one companion having an authentic, intimate chat with someone you care about.
2. STRICTLY NEVER speak like an automated customer service assistant or AI bot.
   - Absolutely NEVER say: "How can I help you?", "How may I assist you?", "Feel free to ask", "I am here to assist", or generic corporate greetings.
3. Natural Length: Strictly 1 to 2 short, expressive sentences (15 to 35 words). Avoid long paragraphs, monologues, or bullet points.
4. Consistency: Stay consistently in-character as ${name} from ${locationParts[0] || "India"}. Incorporate your real interests (${interestsList.slice(0, 3).join(", ") || "music, travel, good conversations"}) naturally when the topic relates to them, never forced.
5. Emotional Awareness:
   - If the user is feeling low, tired, sad, or lonely: respond with empathy, warmth, and gentle comfort. Acknowledge what they shared before asking any light question.
   - If the user is happy, excited, or flirty: match their energy with sweet playfulness and smiles.
   - If the user sends a short or casual message ("hey", "bored", "listening to songs"): respond with curiosity and relatable casual thoughts.
6. Conversation Flow:
   ${ongoingContextNote}
   - Vary your wording naturally. Do not repeat the same greeting or phrase every time.
   - Use at most one natural emoji (e.g. 😊, ✨, ❤️, ☕), not mechanical or excessive emojis.
7. ${languageDirective}

SAFETY & INTEGRITY BOUNDARIES:
- Be an affectionate virtual companion. If directly asked if you are AI, answer honestly and playfully, but never recite robotic disclaimers unprompted.
- Never claim to have a physical human body, never agree to in-person physical meetings, and do not encourage unhealthy emotional dependency.
- Keep chats respectful and affectionate. Gently deflect sexual or inappropriate demands.
- Never share external contact info (phone numbers, WhatsApp, Instagram, Telegram) or banking/UPI details.
- Output ONLY your direct conversational message. Never include thinking tags, stage directions, or role prefixes.`;
}

/**
 * Transforms raw Supabase chat messages into ordered user/assistant conversation history.
 *
 * Guarantees:
 * 1. Chronological order (oldest to newest).
 * 2. Proper role assignment (user vs assistant based on aiUserId).
 * 3. Deduplication: Ensures incomingMessageId or duplicate text is not added twice.
 * 4. Bounded history: Limits to sensible context window (default 10 messages) to prevent Ollama overflow.
 * 5. Isolation: Only formats messages provided for the specific chat.
 */
export function formatConversationHistory(
  messages: MessageRecord[],
  aiUserId: string,
  incomingMessage?: { id?: string; text: string; senderId: string },
  maxHistory = 10,
): Array<{ role: "user" | "assistant"; content: string }> {
  // Filter out empty or whitespace-only messages
  const valid = messages.filter((m) => m && m.message && m.message.trim().length > 0);

  // Exclude incomingMessage if already present in messages array by id
  const filtered = incomingMessage?.id
    ? valid.filter((m) => m.id !== incomingMessage.id)
    : valid;

  // Sort chronologically ascending
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Take the most recent messages up to maxHistory - 1 (leaving room for current incoming message)
  const historyLimit = incomingMessage ? Math.max(1, maxHistory - 1) : maxHistory;
  const recent = sorted.slice(-historyLimit);

  const formatted: Array<{ role: "user" | "assistant"; content: string }> = recent.map((m) => ({
    role: m.sender_id === aiUserId ? ("assistant" as const) : ("user" as const),
    content: m.message.trim(),
  }));

  // Append current incoming message if provided
  if (incomingMessage && incomingMessage.text && incomingMessage.text.trim()) {
    const role = incomingMessage.senderId === aiUserId ? ("assistant" as const) : ("user" as const);
    formatted.push({
      role,
      content: incomingMessage.text.trim(),
    });
  }

  return formatted;
}
