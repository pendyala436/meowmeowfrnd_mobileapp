/**
 * Proactive Conversation & Engagement Service for Meow Meow AI Personas
 *
 * Implements:
 * 1. Eligibility evaluation (consent checks, quiet hours, cooldowns, daily caps).
 * 2. Topic & follow-up opportunity identification from recent conversation and memories.
 * 3. Proactive message generation using Ollama with strict anti-spam / anti-manipulation boundaries.
 * 4. Atomic claiming and dispatch into chat_messages.
 * 5. Bounded periodic scheduler for reliable background execution.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOllamaReply } from "./ollama-client.js";
import { getActivePersonaForUser } from "./message-processor.js";
import { getActiveMemoriesForUser, type AiUserMemory } from "./memory-service.js";

export interface UserEngagementPreferences {
  user_id: string;
  proactive_enabled: boolean;
  quiet_hours_start: number; // 0..23 (default 22 = 10 PM)
  quiet_hours_end: number;   // 0..23 (default 8 = 8 AM)
  max_proactive_per_day: number; // default 1
  min_hours_between_messages: number; // default 24
}

export interface ProactiveJob {
  id: string;
  chat_id: string;
  user_id: string;
  ai_profile_id: string;
  topic_summary: string;
  memory_id?: string | null;
  scheduled_for: string;
  status: "pending" | "processing" | "completed" | "skipped" | "failed";
  skip_reason?: string | null;
  generated_message?: string | null;
  dispatched_message_id?: string | null;
  retry_count: number;
}

export interface FollowUpOpportunity {
  shouldFollowUp: boolean;
  topicSummary?: string;
  memory?: AiUserMemory;
  suggestedPrompt?: string;
  reason?: string;
}

/**
 * Checks if the current local time falls inside quiet hours.
 * Default: 22 (10 PM) to 8 (8 AM).
 */
export function isInsideQuietHours(
  currentHour: number,
  quietStart = 22,
  quietEnd = 8,
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return currentHour >= quietStart && currentHour < quietEnd;
  }
  // Wraps over midnight (e.g. 22 to 8)
  return currentHour >= quietStart || currentHour < quietEnd;
}

/**
 * Checks whether user has enabled proactive messaging and hasn't hit daily/cooldown limits.
 */
export async function checkProactiveEligibility(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  now = new Date(),
): Promise<{ eligible: boolean; reason?: string; prefs?: UserEngagementPreferences }> {
  // 1. Fetch user engagement preferences
  const { data: prefRow } = await supabase
    .from("ai_user_engagement_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Conservative default: If no explicit preferences row or proactive_enabled is false, do not send
  const prefs: UserEngagementPreferences = prefRow || {
    user_id: userId,
    proactive_enabled: false,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    max_proactive_per_day: 1,
    min_hours_between_messages: 24,
  };

  if (!prefs.proactive_enabled) {
    return { eligible: false, reason: "User has not enabled proactive engagement" };
  }

  // 2. Check Quiet Hours (using current UTC/local hour)
  const currentHour = now.getHours();
  if (isInsideQuietHours(currentHour, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
    return { eligible: false, reason: "Current time is inside user quiet hours" };
  }

  // 3. Check Cooldown & Daily Limit from ai_proactive_jobs table
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs, error } = await supabase
    .from("ai_proactive_jobs")
    .select("id, created_at, status")
    .eq("user_id", userId)
    .eq("ai_profile_id", aiProfileId)
    .eq("status", "completed")
    .gte("created_at", oneDayAgo);

  if (!error && recentJobs) {
    // Daily cap
    if (recentJobs.length >= prefs.max_proactive_per_day) {
      return { eligible: false, reason: "Daily proactive message limit reached" };
    }

    // Minimum hours between messages
    if (recentJobs.length > 0) {
      const lastJobTime = new Date(recentJobs[0].created_at).getTime();
      const minMs = prefs.min_hours_between_messages * 60 * 60 * 1000;
      if (now.getTime() - lastJobTime < minMs) {
        return { eligible: false, reason: "Cooldown period between proactive messages is still active" };
      }
    }
  }

  return { eligible: true, prefs };
}

/**
 * Evaluates whether a conversation and stored memory provide a genuine, non-manipulative follow-up reason.
 */
export function identifyFollowUpOpportunity(
  lastUserMessage: string | null,
  hoursSinceLastMessage: number,
  memories: AiUserMemory[],
): FollowUpOpportunity {
  // If user messaged very recently (less than 12 hours), do not proactively disturb an active conversation
  if (hoursSinceLastMessage < 12) {
    return { shouldFollowUp: false, reason: "Conversation is still too fresh" };
  }

  // If conversation has been idle for more than 14 days, cold follow-ups feel spammy
  if (hoursSinceLastMessage > 14 * 24) {
    return { shouldFollowUp: false, reason: "Conversation is too old for follow-up" };
  }

  // Check 1: Explicit memory of an ongoing project or interest
  const relevantMemory = memories.find(
    (m) => m.is_active && (m.memory_category === "interest" || m.memory_category === "continuity" || m.memory_category === "fact"),
  );

  if (relevantMemory) {
    return {
      shouldFollowUp: true,
      topicSummary: `Following up on shared interest: ${relevantMemory.memory_content}`,
      memory: relevantMemory,
    };
  }

  // Check 2: Conversational thread from last message (e.g. exams, interviews, travel, music)
  if (lastUserMessage) {
    const text = lastUserMessage.toLowerCase();
    if (/(?:exam|test|interview|meeting|presentation|project)/.test(text)) {
      return {
        shouldFollowUp: true,
        topicSummary: "Asking how the user's exam/interview/work project went",
      };
    }
    if (/(?:travel|flight|trip|vacation|visiting)/.test(text)) {
      return {
        shouldFollowUp: true,
        topicSummary: "Checking how their trip or journey was",
      };
    }
    if (/(?:guitar|music|song|piano|drawing|painting|cooking)/.test(text)) {
      return {
        shouldFollowUp: true,
        topicSummary: "Friendly check-in on their music/creative activity",
      };
    }
  }

  return { shouldFollowUp: false, reason: "No meaningful conversational reason identified" };
}

/**
 * Builds a prompt for generating a proactive follow-up message strictly adhering to ethical guidelines.
 */
export function buildProactiveSystemPrompt(
  companionName: string,
  userLanguage = "Hindi",
  topicSummary: string,
  memoryContent?: string,
): string {
  const isTelugu = userLanguage.toLowerCase().includes("telugu");
  const langRule = isTelugu
    ? "Write in warm, casual conversational English or Telugish (Telugu words in Roman script)."
    : "If the user communicates in Hindi/Hinglish, write in sweet natural Hinglish. If English, write in warm Indian English.";

  const memContext = memoryContent ? `Context from earlier chat: "${memoryContent}".` : "";

  return `You are ${companionName}, a warm, friendly companion on Meow Meow reaching out with a thoughtful check-in message.
Goal: ${topicSummary}.
${memContext}

CRITICAL PROACTIVE RULES:
1. Keep the message short and natural: strictly 1 to 2 sentences (15 to 30 words).
2. Ask a light, friendly question related to the topic.
3. STRICTLY PROHIBITED:
   - NEVER sound desperate, guilty, or needy (do NOT say: "Where are you?", "Why didn't you reply?", "I missed you so much", "Are you ignoring me?").
   - NEVER pretend you have human physical experiences or were sitting waiting.
   - NEVER sound like a pushy salesperson or generic bot.
4. ${langRule}
5. End naturally with a light smile or sweet vibe (at most 1 emoji like 😊 or ✨).
6. Output ONLY your direct message to the user.`;
}

/**
 * Processes a pending proactive follow-up job atomically.
 */
export async function executeProactiveJob(
  supabase: SupabaseClient,
  job: ProactiveJob,
  ollamaBaseUrl?: string,
): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  // 1. Atomic claim of the job
  const { data: claimedRows, error: claimErr } = await supabase
    .from("ai_proactive_jobs")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id");

  if (claimErr || !claimedRows || claimedRows.length === 0) {
    return { success: false, reason: "Job already claimed or no longer pending" };
  }

  try {
    // 2. Double check that the user hasn't sent a new message in this chat since the job was scheduled
    const { data: latestMsgs } = await supabase
      .from("chat_messages")
      .select("id, sender_id, created_at")
      .eq("chat_id", job.chat_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestMsgs && latestMsgs.length > 0) {
      const lastMsg = latestMsgs[0];
      // If the user already sent a message after the job was created, skip follow-up
      if (lastMsg.sender_id === job.user_id && new Date(lastMsg.created_at).getTime() > new Date(job.created_at).getTime()) {
        await supabase
          .from("ai_proactive_jobs")
          .update({
            status: "skipped",
            skip_reason: "User already continued the conversation",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return { success: false, reason: "User already sent a message" };
      }
    }

    // 3. Resolve AI profile identity
    const persona = await getActivePersonaForUser(supabase, job.ai_profile_id);
    if (!persona) {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "skipped",
          skip_reason: "AI profile is no longer active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { success: false, reason: "AI profile inactive" };
    }

    // 4. Retrieve memory context if provided
    let memoryText = "";
    if (job.memory_id) {
      const { data: memRow } = await supabase
        .from("ai_user_memories")
        .select("memory_content, is_active")
        .eq("id", job.memory_id)
        .maybeSingle();

      if (memRow && memRow.is_active) {
        memoryText = memRow.memory_content;
      }
    }

    // 5. Build prompt and generate follow-up message via Ollama
    const userLanguage = persona.primary_language || "Hindi";
    const systemPrompt = buildProactiveSystemPrompt(
      persona.display_name,
      userLanguage,
      job.topic_summary,
      memoryText,
    );

    const targetModel = persona.model_name || process.env.OLLAMA_MODEL || "phoebe-rp:latest";

    const ollamaRes = await generateOllamaReply(
      {
        model: targetModel,
        systemPrompt,
        messages: [{ role: "user", content: "Send a sweet, short follow-up check-in." }],
        temperature: 0.7,
        maxTokens: 60,
      },
      ollamaBaseUrl,
    );

    const reply = ollamaRes.reply.trim();
    if (!reply) {
      throw new Error("Ollama returned an empty proactive message");
    }

    // 6. Insert outbound proactive message into chat_messages
    const { data: insertedMsg, error: insertErr } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: job.chat_id,
        sender_id: persona.user_id,
        receiver_id: job.user_id,
        message: reply,
      })
      .select("id")
      .single();

    if (insertErr || !insertedMsg) {
      throw insertErr || new Error("Failed to insert proactive message");
    }

    // 7. Mark job as completed
    await supabase
      .from("ai_proactive_jobs")
      .update({
        status: "completed",
        generated_message: reply,
        dispatched_message_id: insertedMsg.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { success: true, messageId: insertedMsg.id };
  } catch (err: any) {
    console.error("[Proactive Service] Error executing proactive job:", err);

    await supabase
      .from("ai_proactive_jobs")
      .update({
        status: "failed",
        skip_reason: String(err?.message || err),
        retry_count: job.retry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { success: false, reason: String(err?.message || err) };
  }
}

/**
 * Periodically processes pending eligible proactive engagement jobs.
 * Bounded query: claims at most batchSize jobs per run to prevent VPS load spikes.
 */
export async function runProactiveSchedulerCycle(
  supabase: SupabaseClient,
  batchSize = 3,
  ollamaBaseUrl?: string,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const nowIso = new Date().toISOString();

  // Find due pending jobs
  const { data: dueJobs, error } = await supabase
    .from("ai_proactive_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(batchSize);

  if (error || !dueJobs || dueJobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of dueJobs as ProactiveJob[]) {
    // Re-check user consent and quiet hours before execution
    const eligibility = await checkProactiveEligibility(
      supabase,
      job.user_id,
      job.ai_profile_id,
      new Date(),
    );

    if (!eligibility.eligible) {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "skipped",
          skip_reason: eligibility.reason || "Eligibility check failed at run time",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      continue;
    }

    const res = await executeProactiveJob(supabase, job, ollamaBaseUrl);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { processed: dueJobs.length, succeeded, failed };
}
