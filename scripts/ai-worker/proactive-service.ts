/**
 * Proactive Conversation & Autonomous Engagement Service for Meow Meow AI Personas (v2.6.0)
 *
 * Implements:
 * 1. Eligibility evaluation (master opt-in, quiet hours, user timezone, per-profile overrides, cooldowns, daily caps, block checks).
 * 2. Autonomous Opportunity Discovery: Periodically scans active AI-managed conversations to identify natural follow-up reasons.
 * 3. Opportunity categorization ('unfinished_topic', 'upcoming_event', 'event_followup', 'personal_goal', 'shared_interest', 'emotional_support', 'conversation_continuation').
 * 4. Multi-stage Consent & Safety Re-validation (atomic claim, pre-generation check, pre-dispatch recheck, user message invalidation).
 * 5. Proactive message generation using Ollama with strict anti-spam / anti-manipulation boundaries.
 * 6. Atomic claiming, duplicate prevention, and dispatch into chat_messages.
 * 7. Bounded periodic scheduler & autonomous discovery cycles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOllamaReply } from "./ollama-client.js";
import { getActivePersonaForUser } from "./message-processor.js";
import { getActiveMemoriesForUser, type AiUserMemory } from "./memory-service.js";

export type OpportunityCategory =
  | "unfinished_topic"
  | "upcoming_event"
  | "event_followup"
  | "personal_goal"
  | "shared_interest"
  | "emotional_support"
  | "conversation_continuation";

export interface UserEngagementPreferences {
  user_id: string;
  proactive_enabled: boolean;
  quiet_hours_start: number; // 0..23 (default 22 = 10 PM)
  quiet_hours_end: number;   // 0..23 (default 8 = 8 AM)
  max_proactive_per_day: number; // default 1 (max 5)
  min_hours_between_messages: number; // default 24 (min 6)
  timezone?: string; // default 'Asia/Kolkata'
  disabled_profile_ids?: string[]; // Per-profile block list
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
  opportunity_category?: OpportunityCategory;
  confidence_score?: number;
  discovery_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface FollowUpOpportunity {
  shouldFollowUp: boolean;
  category?: OpportunityCategory;
  topicSummary?: string;
  memory?: AiUserMemory;
  suggestedPrompt?: string;
  confidence?: number;
  reason?: string;
}

/**
 * Checks if the current local time in given timezone falls inside quiet hours.
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
 * Computes current hour in user's configured timezone (fallback to Asia/Kolkata or UTC).
 */
export function getCurrentHourInTimezone(date: Date, tz = "Asia/Kolkata"): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(date), 10) % 24;
  } catch {
    return date.getHours();
  }
}

/**
 * Comprehensive eligibility evaluation:
 * - Master opt-in consent
 * - Per-AI-profile disabled check
 * - User block / restriction check
 * - Timezone-aware Quiet Hours check
 * - Global Daily Cap check across all AI profiles
 * - Minimum Cooldown interval check
 */
export async function checkProactiveEligibility(
  supabase: SupabaseClient,
  userId: string,
  aiProfileId: string,
  now = new Date(),
): Promise<{ eligible: boolean; reason?: string; prefs?: UserEngagementPreferences }> {
  // 1. Fetch user master engagement preferences
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
    timezone: "Asia/Kolkata",
    disabled_profile_ids: [],
  };

  // Master opt-out is absolute
  if (!prefs.proactive_enabled) {
    return { eligible: false, reason: "User has not enabled proactive engagement" };
  }

  // 2. Check per-profile exclusion list
  if (prefs.disabled_profile_ids && prefs.disabled_profile_ids.includes(aiProfileId)) {
    return { eligible: false, reason: "Proactive engagement is disabled for this specific AI profile" };
  }

  // Check granular per-profile table if present
  const { data: perProfilePref } = await supabase
    .from("ai_user_profile_engagement_preferences")
    .select("proactive_enabled")
    .eq("user_id", userId)
    .eq("ai_profile_id", aiProfileId)
    .maybeSingle();

  if (perProfilePref && !perProfilePref.proactive_enabled) {
    return { eligible: false, reason: "Proactive engagement explicitly disabled for this AI profile" };
  }

  // 3. Check if user or AI profile is blocked
  const { data: blockRow } = await supabase
    .from("user_blocks")
    .select("id")
    .or(`and(blocked_by.eq.${userId},blocked_user_id.eq.${aiProfileId}),and(blocked_by.eq.${aiProfileId},blocked_user_id.eq.${userId})`)
    .limit(1);

  if (blockRow && blockRow.length > 0) {
    return { eligible: false, reason: "User or AI profile is blocked" };
  }

  // 4. Timezone-aware Quiet Hours check
  const currentHour = getCurrentHourInTimezone(now, prefs.timezone || "Asia/Kolkata");
  if (isInsideQuietHours(currentHour, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
    return { eligible: false, reason: "Current time is inside user quiet hours" };
  }

  // 5. Cooldown & Global Daily Cap across all AI profiles (Anti-Spam requirement)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs, error } = await supabase
    .from("ai_proactive_jobs")
    .select("id, created_at, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false });

  if (!error && recentJobs) {
    // Global daily cap enforced across all AI profiles
    if (recentJobs.length >= prefs.max_proactive_per_day) {
      return { eligible: false, reason: "Daily proactive message limit reached" };
    }

    // Cooldown period enforcement
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
 * Categorizes the opportunity into a structured opportunity_category with confidence score.
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

  // Rule 1: Check memories for personal goals, upcoming events, or interests
  const goalMemory = memories.find(
    (m) => m.is_active && m.memory_category === "goal",
  );
  if (goalMemory) {
    return {
      shouldFollowUp: true,
      category: "personal_goal",
      topicSummary: `Following up on user personal goal: ${goalMemory.memory_content}`,
      memory: goalMemory,
      confidence: 0.90,
    };
  }

  const interestMemory = memories.find(
    (m) => m.is_active && (m.memory_category === "interest" || m.memory_category === "shared_interest"),
  );
  if (interestMemory) {
    return {
      shouldFollowUp: true,
      category: "shared_interest",
      topicSummary: `Following up on shared interest: ${interestMemory.memory_content}`,
      memory: interestMemory,
      confidence: 0.85,
    };
  }

  // Rule 2: Conversational thread from last user message
  if (lastUserMessage) {
    const text = lastUserMessage.toLowerCase();

    // Check for upcoming event / exam / interview / presentation
    if (/(?:tomorrow|next week|this week|soon|tonight).*(?:exam|interview|presentation|meeting|test)/.test(text) ||
        /(?:exam|interview|presentation|meeting|test).*(?:tomorrow|next week|this week|soon|tonight)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "upcoming_event",
        topicSummary: "Asking about the user's upcoming presentation, exam, or interview",
        confidence: 0.92,
      };
    }

    if (/(?:exam|test|interview|meeting|presentation|project)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "event_followup",
        topicSummary: "Asking how the user's exam/interview/work project went",
        confidence: 0.88,
      };
    }

    // Check for travel / vacation
    if (/(?:travel|flight|trip|vacation|visiting|journey)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "event_followup",
        topicSummary: "Checking how their trip or journey was",
        confidence: 0.86,
      };
    }

    // Creative hobbies / personal activity
    if (/(?:guitar|music|song|piano|drawing|painting|cooking|gym|workout)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "personal_goal",
        topicSummary: "Friendly check-in on their music, fitness, or creative hobby",
        confidence: 0.84,
      };
    }

    // Emotional support opportunity
    if (/(?:tired|exhausted|stressed|hectic|rough day|tough day|headache|fever)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "emotional_support",
        topicSummary: "Checking in to see if the user is feeling better and well-rested",
        confidence: 0.85,
      };
    }

    // Unfinished conversational topic
    if (/(?:let you know|talk later|tell you more|remind me|brb|gotta go)/.test(text)) {
      return {
        shouldFollowUp: true,
        category: "unfinished_topic",
        topicSummary: "Continuing previous unfinished conversation thread",
        confidence: 0.82,
      };
    }
  }

  // General continuation fallback if memory exists
  const generalMemory = memories.find((m) => m.is_active && m.memory_category === "fact");
  if (generalMemory) {
    return {
      shouldFollowUp: true,
      category: "conversation_continuation",
      topicSummary: `Warm conversational check-in regarding ${generalMemory.memory_content}`,
      memory: generalMemory,
      confidence: 0.75,
    };
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
  category: OpportunityCategory = "conversation_continuation",
): string {
  const isTelugu = userLanguage.toLowerCase().includes("telugu");
  const langRule = isTelugu
    ? "Write in warm, casual conversational English or Telugish (Telugu words in Roman script)."
    : "If the user communicates in Hindi/Hinglish, write in sweet natural Hinglish. If English, write in warm Indian English.";

  const memContext = memoryContent ? `Context from earlier chat: "${memoryContent}".` : "";

  return `You are ${companionName}, a warm, friendly companion on Meow Meow reaching out with a thoughtful check-in message.
Goal: ${topicSummary} (context category: ${category}).
${memContext}

CRITICAL PROACTIVE RULES:
1. Keep the message short and natural: strictly 1 to 2 sentences (15 to 30 words).
2. Ask a light, friendly question related to the topic.
3. STRICTLY PROHIBITED:
   - NEVER sound desperate, guilty, or needy (do NOT say: "Where are you?", "Why didn't you reply?", "I missed you so much", "Are you ignoring me?").
   - NEVER pretend you have human physical experiences or were sitting waiting.
   - NEVER sound like a pushy salesperson or generic bot.
   - NEVER send guilt-based or emotional dependency statements.
4. ${langRule}
5. End naturally with a light smile or sweet vibe (at most 1 emoji like 😊 or ✨).
6. Output ONLY your direct message to the user.`;
}

/**
 * Processes a pending proactive follow-up job atomically with strict multi-stage consent re-checks.
 */
export async function executeProactiveJob(
  supabase: SupabaseClient,
  job: ProactiveJob,
  ollamaBaseUrl?: string,
): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  // 1. Atomic claim of the job (prevents concurrent double processing)
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
    // 2. Pre-generation eligibility and user activity check
    const preCheck = await checkProactiveEligibility(supabase, job.user_id, job.ai_profile_id, new Date());
    if (!preCheck.eligible) {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "skipped",
          skip_reason: preCheck.reason || "Eligibility revoked before generation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { success: false, reason: preCheck.reason };
    }

    // Check if the user sent a new message in this chat
    const { data: latestMsgs } = await supabase
      .from("chat_messages")
      .select("id, sender_id, created_at")
      .eq("chat_id", job.chat_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestMsgs && latestMsgs.length > 0) {
      const lastMsg = latestMsgs[0];
      const jobCreatedTime = job.created_at ? new Date(job.created_at).getTime() : 0;
      if (lastMsg.sender_id === job.user_id && new Date(lastMsg.created_at).getTime() > jobCreatedTime) {
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

    // 3. Resolve AI profile identity (must be active AI persona or AI-managed female profile)
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

    // 4. Retrieve private memory context scoped strictly to (user_id, ai_profile_id)
    let memoryText = "";
    if (job.memory_id) {
      const { data: memRow } = await supabase
        .from("ai_user_memories")
        .select("memory_content, is_active, user_id, ai_profile_id")
        .eq("id", job.memory_id)
        .eq("user_id", job.user_id)
        .eq("ai_profile_id", job.ai_profile_id)
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
      job.opportunity_category || "conversation_continuation",
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

    // 6. CRITICAL RACE CONDITION PROTECTION: Recheck consent immediately before insertion
    const postCheck = await checkProactiveEligibility(supabase, job.user_id, job.ai_profile_id, new Date());
    if (!postCheck.eligible) {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "skipped",
          skip_reason: postCheck.reason || "User opted out during generation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { success: false, reason: "Opted out during generation" };
    }

    // 7. Insert outbound proactive message into chat_messages
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

    // 8. Mark job as completed
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
        retry_count: (job.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { success: false, reason: String(err?.message || err) };
  }
}

/**
 * Recovers stale jobs stuck in 'processing' status (e.g. from worker restart or timeout).
 * Resets jobs older than 10 minutes back to 'pending' or marks failed if retries exceeded.
 */
export async function recoverStaleProcessingJobs(
  supabase: SupabaseClient,
  staleMinutes = 10,
): Promise<number> {
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

  const { data: staleJobs } = await supabase
    .from("ai_proactive_jobs")
    .select("id, retry_count")
    .eq("status", "processing")
    .lte("updated_at", staleThreshold);

  if (!staleJobs || staleJobs.length === 0) return 0;

  let recovered = 0;
  for (const job of staleJobs) {
    if ((job.retry_count || 0) >= 3) {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "failed",
          skip_reason: "Max retries exceeded during recovery",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } else {
      await supabase
        .from("ai_proactive_jobs")
        .update({
          status: "pending",
          retry_count: (job.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      recovered++;
    }
  }

  return recovered;
}

/**
 * Autonomous Opportunity Discovery Engine:
 * Scans eligible opted-in users who have recent conversations with AI profiles,
 * detects conversational threads and memories, and automatically schedules
 * structured proactive jobs.
 */
export async function runOpportunityDiscoveryCycle(
  supabase: SupabaseClient,
  batchLimit = 10,
): Promise<{ evaluated: number; opportunitiesFound: number; jobsCreated: number }> {
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch opted-in users only (strictly respecting default opt-out)
  const { data: optedInUsers, error: userErr } = await supabase
    .from("ai_user_engagement_preferences")
    .select("user_id, timezone, disabled_profile_ids")
    .eq("proactive_enabled", true)
    .limit(batchLimit);

  if (userErr || !optedInUsers || optedInUsers.length === 0) {
    return { evaluated: 0, opportunitiesFound: 0, jobsCreated: 0 };
  }

  let evaluated = 0;
  let opportunitiesFound = 0;
  let jobsCreated = 0;

  for (const userPref of optedInUsers) {
    evaluated++;
    const userId = userPref.user_id;

    // 2. Find recent conversations for this user within the 12h-14d idle window
    const { data: recentMsgs } = await supabase
      .from("chat_messages")
      .select("chat_id, sender_id, receiver_id, message, created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .lte("created_at", twelveHoursAgo)
      .gte("created_at", fourteenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!recentMsgs || recentMsgs.length === 0) continue;

    // Group messages by chat_id
    const chatMap = new Map<string, typeof recentMsgs>();
    for (const msg of recentMsgs) {
      if (!chatMap.has(msg.chat_id)) {
        chatMap.set(msg.chat_id, []);
      }
      chatMap.get(msg.chat_id)!.push(msg);
    }

    for (const [chatId, msgs] of chatMap.entries()) {
      // Find the other party
      const otherId = msgs[0].sender_id === userId ? msgs[0].receiver_id : msgs[0].sender_id;
      if (!otherId) continue;

      // Check if other party is an active AI persona or AI-managed profile
      const persona = await getActivePersonaForUser(supabase, otherId);
      if (!persona) continue;

      // Check per-profile exclusion
      if (userPref.disabled_profile_ids && userPref.disabled_profile_ids.includes(otherId)) {
        continue;
      }

      // Check if there is already a pending or recent proactive job for this chat
      const { data: existingJob } = await supabase
        .from("ai_proactive_jobs")
        .select("id, status, created_at")
        .eq("chat_id", chatId)
        .in("status", ["pending", "processing"])
        .maybeSingle();

      if (existingJob) continue; // Already scheduled or in-flight

      // Also ensure no follow-up was completed in this chat in the last 24h
      const { data: recentCompleted } = await supabase
        .from("ai_proactive_jobs")
        .select("id")
        .eq("chat_id", chatId)
        .eq("status", "completed")
        .gte("created_at", twelveHoursAgo)
        .maybeSingle();

      if (recentCompleted) continue;

      // Find the last user message in this chat
      const lastUserMsg = msgs.find((m) => m.sender_id === userId);
      const lastMsgDate = new Date(msgs[0].created_at);
      const hoursIdle = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60 * 60);

      // Retrieve scoped memories
      const memories = await getActiveMemoriesForUser(supabase, userId, otherId);

      // Evaluate opportunity
      const opp = identifyFollowUpOpportunity(
        lastUserMsg?.message || null,
        hoursIdle,
        memories,
      );

      if (opp.shouldFollowUp && opp.topicSummary) {
        opportunitiesFound++;

        // Schedule future job (e.g. 1 hour from now or next morning outside quiet hours)
        const scheduledTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 mins future delay
        const { error: insertJobErr } = await supabase
          .from("ai_proactive_jobs")
          .insert({
            chat_id: chatId,
            user_id: userId,
            ai_profile_id: otherId,
            topic_summary: opp.topicSummary,
            opportunity_category: opp.category || "conversation_continuation",
            confidence_score: opp.confidence || 0.80,
            memory_id: opp.memory?.id || null,
            scheduled_for: scheduledTime.toISOString(),
            status: "pending",
            discovery_metadata: {
              discovered_at: now.toISOString(),
              hours_idle: Math.round(hoursIdle),
              trigger: opp.category,
            },
          });

        if (!insertJobErr) {
          jobsCreated++;
        }
      }
    }
  }

  return { evaluated, opportunitiesFound, jobsCreated };
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

  // 1. Recover any stale processing jobs first
  await recoverStaleProcessingJobs(supabase, 10);

  // 2. Find due pending jobs
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
    // Re-check user consent, quiet hours, cooldown, and limits before execution
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
