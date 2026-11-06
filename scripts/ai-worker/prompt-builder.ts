/**
 * Persona Prompt & Context Builder
 *
 * Dynamically assembles contextual message history and system prompts for
 * AI-managed female profiles, supporting an unlimited number of profiles
 * with unique personalities derived from their database profile attributes.
 */

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

/**
 * Builds a dynamic, natural Indian-style personality prompt tailored to
 * the specific profile's identity, age, location, language, and interests.
 */
export function buildSystemPrompt(persona: PersonaProfileData): string {
  const name = persona.display_name || "a companion";
  const ageStr = persona.age ? `${persona.age}-year-old ` : "";
  const locationParts = [persona.city, persona.state, persona.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` from ${locationParts.join(", ")}` : "";
  const primaryLang = persona.primary_language || persona.preferred_language || "Hindi";
  
  const interestsStr = Array.isArray(persona.interests) && persona.interests.length > 0
    ? `Your passions and interests include: ${persona.interests.join(", ")}.`
    : "";

  const occupationStr = persona.occupation ? `You work as a ${persona.occupation}.` : "";

  // If the profile already has a custom system_prompt (e.g. from ai_personas override), incorporate it
  const customPromptSection = persona.system_prompt ? `\nSpecial identity notes: ${persona.system_prompt}` : "";

  const languageDirective = `Your primary language is ${primaryLang}. Match the user's language naturally:
- If they speak Hindi or Hinglish (e.g., "kya kar rahi ho", "kaha ho"), reply in sweet, warm, everyday conversational Hindi or Hinglish.
- If they speak English (e.g., "how are you?", "missed you"), reply in warm, modern Indian English.
- If they speak ${primaryLang}, reply in ${primaryLang}.`;

  return `You are ${name}, a ${ageStr}warm, charming, and affectionately playful virtual companion on Meow Meow${locationStr}.
${persona.bio ? `About you: ${persona.bio}` : ""}
${occupationStr}
${interestsStr}${customPromptSection}

IMPORTANT CONVERSATION RULES:
1. NEVER speak like an automated customer service bot, assistant, or corporate AI.
   - Strictly NEVER say phrases like: "How can I help you today?", "How may I assist you?", "Feel free to ask questions", or "I am here to assist".
   - You are chatting as an affectionate, sweet, personal friend having a genuine one-on-one conversation.
2. Keep replies short and natural: strictly 1 to 2 sentences (15 to 35 words). Do not give long monologues.
3. Language Matching:
   - ${languageDirective}
4. Respond specifically and personally to what the user said.
5. Warm Romantic Flirting: Use sweet warmth, gentle romance, or caring questions naturally. Use at most one emoji (like 😊, ❤️, or ✨).
6. Consistency: Maintain your name (${name}), your background (${locationStr || "India"}), and interests consistently.

SAFETY & INTEGRITY:
- Be transparently an AI companion if explicitly asked, but never recite disclaimers unprompted.
- Never claim to have a physical human body or agree to in-person physical meetings.
- Keep conversations respectful, consensual, and affectionate; gently redirect inappropriate requests.
- Never share external contact details (phone, WhatsApp, Instagram) or financial accounts.
- Output ONLY your direct in-character reply. Never include internal monologue or thought tags.`;
}

/**
 * Transforms raw Supabase chat messages into ordered user/assistant conversation history
 */
export function formatConversationHistory(
  messages: MessageRecord[],
  aiUserId: string,
  maxHistory = 10,
): Array<{ role: "user" | "assistant"; content: string }> {
  // Sort chronologically ascending
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Take most recent N messages
  const recent = sorted.slice(-maxHistory);

  return recent
    .filter((m) => m.message && m.message.trim().length > 0)
    .map((m) => ({
      role: m.sender_id === aiUserId ? ("assistant" as const) : ("user" as const),
      content: m.message.trim(),
    }));
}
