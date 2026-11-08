/**
 * Long-Term Conversational Memory Service for Meow Meow AI Personas
 *
 * Implements:
 * 1. Automatic memory extraction from user conversation content.
 * 2. Privacy & sensitivity protection (strictly blocks passwords, credentials, medical, sexual info).
 * 3. Memory management commands (Remember, Recall, Forget, Do not remember).
 * 4. Relationship-isolated storage & retrieval (user_id <-> ai_profile_id pair).
 * 5. Conflict resolution & update of changed user preferences.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryCategory = "preference" | "interest" | "personal" | "continuity" | "fact" | "other";

export interface AiUserMemory {
  id: string;
  user_id: string;
  ai_profile_id: string;
  memory_content: string;
  memory_category: MemoryCategory;
  importance: number; // 1 to 5
  confidence: number; // 0.00 to 1.00
  source_message_id?: string | null;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractedMemoryItem {
  content: string;
  category: MemoryCategory;
  importance: number;
  confidence: number;
}

export type MemoryCommandType = "remember" | "recall" | "forget" | "do_not_remember";

export interface MemoryCommandResult {
  handled: boolean;
  type?: MemoryCommandType;
  replyText?: string;
  success?: boolean;
}

/**
 * Sensitive patterns that MUST NEVER be committed to long-term memory.
 */
const SENSITIVE_PATTERNS = [
  // Passwords, PINs, OTPs, auth codes, credit card / UPI / bank numbers
  /(?:password|passwd|pin|otp|cvv|token|secret|key|credit card|debit card|upi|bank account|routing|aadhar|pan card)/i,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // 16-digit card
  /\b\d{6}\b/, // 6-digit OTP/PIN
  // Explicit sexual / erotic content
  /(?:nude|naked|sex|porn|orgasm|penis|vagina|boobs|erotic|intercourse)/i,
  // Sensitive medical / diagnosis details
  /(?:chemotherapy|hiv|aids|std|cancer diagnosis|bipolar disorder|suicide|prescribed medicine|antidepressant)/i,
  // Religious / political debate beliefs
  /(?:hate all|vote for|political party|religion is|caste)/i,
];

/**
 * Checks whether content contains sensitive, private, or prohibited information.
 */
export function containsSensitiveInfo(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Trivial / low-value message patterns that should never become permanent memory.
 */
const TRIVIAL_PATTERNS = [
  /^(?:hi|hey|hello|namaste|kasa kay|vanakkam|gm|gn|good morning|good night|bye|ttyl|ok|okay|cool|ok cool|hmm|hmmm|haan|theek hai|acha|accha|nice|lol|haha|hehe)\b[!?.]*$/i,
  /^(?:kya kar rahi ho|kahan ho|what are you doing|where are you|how are you|kaisa chal raha hai)\b[!?.]*$/i,
  /^(?:are you real|are you ai|who are you|what is your name)\b[!?.]*$/i,
];

export function isTrivialMessage(text: string): boolean {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  return TRIVIAL_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Detects whether the user is giving an explicit memory management command:
 * - "Remember that I love acoustic guitar"
 * - "What do you remember about me?" / "What do you know about me?"
 * - "Forget my language preference" / "Forget what I said about my job"
 * - "Don't remember this conversation"
 */
export function detectMemoryCommand(text: string): { type: MemoryCommandType; target?: string } | null {
  const trimmed = text.trim();

  // 1. Recall request
  if (
    /^(?:what do you remember(?: about me)?|what do you know about me|tell me what you remember|do you remember anything about me)\??$/i.test(
      trimmed,
    )
  ) {
    return { type: "recall" };
  }

  // 2. Forget request
  const forgetMatch = trimmed.match(
    /^(?:forget(?: that| what I told you about| my| about)?|delete memory about|remove memory about)\s+(.+)$/i,
  );
  if (forgetMatch && forgetMatch[1]) {
    return { type: "forget", target: forgetMatch[1].trim().replace(/[.!?]+$/, "") };
  }

  // 3. Do not remember request
  if (
    /^(?:don't remember this(?: conversation)?|do not remember this|please don't remember this|keep this off the record)\b/i.test(
      trimmed,
    )
  ) {
    return { type: "do_not_remember" };
  }

  // 4. Explicit remember request
  const rememberMatch = trimmed.match(
    /^(?:(?:please )?remember (?:that|my)?|keep in mind (?:that)?|make sure you remember (?:that)?)\s+(.+)$/i,
  );
  if (rememberMatch && rememberMatch[1]) {
    return { type: "remember", target: rememberMatch[1].trim().replace(/[.!?]+$/, "") };
  }

  return null;
}

/**
 * Extracts candidate long-term memory items from conversational user text.
 */
export function extractMemoriesFromText(text: string): ExtractedMemoryItem[] {
  if (!text || isTrivialMessage(text) || containsSensitiveInfo(text)) {
    return [];
  }

  const items: ExtractedMemoryItem[] = [];
  const clean = text.trim();

  // Pattern A: Language Preferences
  // e.g. "I prefer speaking in Hindi", "Let's speak in Telugu", "My preferred language is English"
  const langMatch = clean.match(
    /(?:(?:I (?:prefer|like) (?:speaking|chatting|to speak) in|My (?:preferred|primary) language is|Let's speak in|baat karte hai)\s+([A-Za-z]+))/i,
  );
  if (langMatch && langMatch[1]) {
    const lang = langMatch[1].trim();
    if (["hindi", "english", "telugu", "tamil", "bengali", "kannada", "malayalam", "marathi", "gujarati"].includes(lang.toLowerCase())) {
      items.push({
        content: `User prefers communicating in ${lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase()}`,
        category: "preference",
        importance: 4,
        confidence: 0.95,
      });
    }
  }

  // Pattern B: Interests / Passions
  // e.g. "I love listening to acoustic guitar", "I really enjoy trekking and photography", "My hobby is cooking"
  const interestMatch = clean.match(
    /(?:I (?:love|enjoy|really like|am passionate about)|My (?:hobby is|passions are))\s+([^.,!]+)/i,
  );
  if (interestMatch && interestMatch[1]) {
    const rawInterest = interestMatch[1].trim();
    if (!containsSensitiveInfo(rawInterest) && rawInterest.length > 3 && rawInterest.length < 80) {
      items.push({
        content: `User enjoys ${rawInterest}`,
        category: "interest",
        importance: 3,
        confidence: 0.90,
      });
    }
  }

  // Pattern C: Personal Facts / Profession / Location
  // e.g. "I work as a software engineer", "I am a college student in Pune", "I live in Bengaluru"
  const jobMatch = clean.match(
    /(?:I work as (?:a|an)|I am (?:a|an)|My job is)\s+([^.,!]+)/i,
  );
  if (jobMatch && jobMatch[1]) {
    const job = jobMatch[1].trim();
    if (!containsSensitiveInfo(job) && job.length > 3 && job.length < 60) {
      items.push({
        content: `User's occupation is ${job}`,
        category: "personal",
        importance: 4,
        confidence: 0.90,
      });
    }
  }

  const locMatch = clean.match(
    /(?:I (?:live|stay|reside) in|I am from)\s+([A-Z][a-zA-Z\s]{2,25})/i,
  );
  if (locMatch && locMatch[1]) {
    const loc = locMatch[1].trim();
    if (!containsSensitiveInfo(loc) && loc.length > 2 && loc.length < 35) {
      items.push({
        content: `User is based in ${loc}`,
        category: "personal",
        importance: 3,
        confidence: 0.85,
      });
    }
  }

  // Pattern D: Explicit Name / Nickname
  // e.g. "You can call me Rahul", "My name is Amit"
  const nameMatch = clean.match(
    /(?:(?:You can )?call me|My name is)\s+([A-Z][a-zA-Z]{1,20})/i,
  );
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].trim();
    items.push({
      content: `User's preferred name is ${name}`,
      category: "personal",
      importance: 5,
      confidence: 0.98,
    });
  }

  return items;
}

/**
 * Retrieves active long-term memories strictly isolated to a specific user and AI profile relationship.
 */
export async function getActiveMemoriesForUser(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  limit = 5,
): Promise<AiUserMemory[]> {
  const { data, error } = await supabase
    .from("ai_user_memories")
    .select("*")
    .eq("user_id", userId)
    .eq("ai_profile_id", aiProfileId)
    .eq("is_active", true)
    .order("importance", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as AiUserMemory[];
}

/**
 * Stores or updates long-term memory for a specific user and AI profile.
 * Handles deduplication and updates to contradictory preferences.
 */
export async function saveOrUpdateMemory(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  memory: ExtractedMemoryItem,
  sourceMessageId?: string,
): Promise<boolean> {
  // Never save sensitive info
  if (containsSensitiveInfo(memory.content)) {
    return false;
  }

  // Conflict resolution: If this is a language preference or occupation,
  // deactivate older contradictory memories of the same sub-topic
  if (memory.category === "preference" && /language/i.test(memory.content)) {
    await supabase
      .from("ai_user_memories")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("ai_profile_id", aiProfileId)
      .eq("memory_category", "preference")
      .ilike("memory_content", "%prefers communicating in%");
  } else if (memory.category === "personal" && /occupation/i.test(memory.content)) {
    await supabase
      .from("ai_user_memories")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("ai_profile_id", aiProfileId)
      .eq("memory_category", "personal")
      .ilike("memory_content", "%occupation is%");
  }

  // Insert or upsert using unique constraint (user_id, ai_profile_id, memory_category, memory_content)
  const { error } = await supabase.from("ai_user_memories").upsert(
    {
      user_id: userId,
      ai_profile_id: aiProfileId,
      memory_content: memory.content.trim(),
      memory_category: memory.category,
      importance: memory.importance,
      confidence: memory.confidence,
      source_message_id: sourceMessageId || null,
      is_active: true,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,ai_profile_id,memory_category,memory_content",
    },
  );

  return !error;
}

/**
 * Deactivates or removes memories matching a user's forget target.
 */
export async function forgetMemories(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  target?: string,
): Promise<number> {
  let query = supabase
    .from("ai_user_memories")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("ai_profile_id", aiProfileId)
    .eq("is_active", true);

  if (target && target.trim()) {
    query = query.ilike("memory_content", `%${target.trim()}%`);
  }

  const { data, error } = await query.select("id");
  if (error || !data) return 0;
  return data.length;
}

/**
 * Executes a memory management command if present in the user's message.
 * Returns handled=true if an explicit command was processed.
 */
export async function handleMemoryCommandIfPresent(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  companionName: string,
  messageText: string,
  sourceMessageId?: string,
): Promise<MemoryCommandResult> {
  const cmd = detectMemoryCommand(messageText);
  if (!cmd) return { handled: false };

  // 1. RECALL
  if (cmd.type === "recall") {
    const memories = await getActiveMemoriesForUser(supabase, userId, aiProfileId, 10);
    if (memories.length === 0) {
      return {
        handled: true,
        type: "recall",
        success: true,
        replyText: `I don't have any specific personal notes saved yet! As we chat more, I'll naturally remember what you enjoy and prefer. 😊`,
      };
    }

    const memoryPoints = memories.map((m) => `• ${m.memory_content}`).join("\n");
    return {
      handled: true,
      type: "recall",
      success: true,
      replyText: `Here is what I remember about you, my dear:\n${memoryPoints}\n\nYou can ask me to forget anything anytime! ✨`,
    };
  }

  // 2. FORGET
  if (cmd.type === "forget") {
    const count = await forgetMemories(supabase, userId, aiProfileId, cmd.target);
    if (count > 0) {
      return {
        handled: true,
        type: "forget",
        success: true,
        replyText: `Done! I've removed that from my memories for our conversations. ✨`,
      };
    } else {
      return {
        handled: true,
        type: "forget",
        success: true,
        replyText: `I checked my notes, but I didn't find any stored memories matching that. We're all clear! 😊`,
      };
    }
  }

  // 3. DO NOT REMEMBER
  if (cmd.type === "do_not_remember") {
    return {
      handled: true,
      type: "do_not_remember",
      success: true,
      replyText: `Understood! I will keep this conversation strictly in the moment and will not save anything from it to memory. 😊`,
    };
  }

  // 4. REMEMBER
  if (cmd.type === "remember" && cmd.target) {
    if (containsSensitiveInfo(cmd.target)) {
      return {
        handled: true,
        type: "remember",
        success: false,
        replyText: `For your privacy and safety, I cannot store sensitive personal details like passwords or financial accounts. But I'm always happy to remember your interests and preferences! 😊`,
      };
    }

    const saved = await saveOrUpdateMemory(
      supabase,
      userId,
      aiProfileId,
      {
        content: cmd.target,
        category: "fact",
        importance: 4,
        confidence: 0.95,
      },
      sourceMessageId,
    );

    if (saved) {
      return {
        handled: true,
        type: "remember",
        success: true,
        replyText: `Got it, I've noted that down! I will remember that during our chats. ❤️`,
      };
    }
  }

  return { handled: false };
}
