/**
 * AI Message Processor Service
 *
 * Handles atomic job locking, duplicate prevention, dynamic female profile resolution,
 * Ollama inference, and response dispatch to `public.chat_messages`.
 *
 * Fully scalable: Supports all eligible AI-managed female profiles dynamically
 * without requiring predefined registrations in `ai_personas` or any 100-limit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOllamaReply } from "./ollama-client.js";
import {
  buildSystemPrompt,
  formatConversationHistory,
  type PersonaProfileData,
  type MessageRecord,
} from "./prompt-builder.js";

export interface ProcessIncomingMessageParams {
  messageId: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  messageText: string;
  supabase: SupabaseClient;
  ollamaBaseUrl?: string;
  modelOverride?: string;
}

export interface ProcessResult {
  status: "skipped" | "processed" | "failed";
  reason?: string;
  replyId?: string;
  replyText?: string;
}

/**
 * Dynamically resolves whether a recipient user ID is an eligible AI-managed female profile.
 *
 * Resolution logic (no hardcoded limits):
 * 1. Checks `female_profiles` using indexed lookup for `user_id`, verifying:
 *    - `is_ai_managed = true`
 *    - `approval_status = 'approved'`
 *    - `account_status = 'active'`
 * 2. If not found or column missing, checks legacy `ai_personas` table for backward compatibility (e.g. Aarya).
 * 3. Never treats normal human female profiles as AI (requires explicit AI designation).
 */
export async function getActivePersonaForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PersonaProfileData | null> {
  // Query 1: Dynamic Female Profile lookup
  const { data: femaleProfile, error: fpError } = await supabase
    .from("female_profiles")
    .select(
      "id, user_id, full_name, age, bio, country, state, primary_language, preferred_language, interests, occupation, approval_status, account_status, is_ai_managed"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!fpError && femaleProfile) {
    // Safety check: Profile must be active and approved
    const isApprovedAndActive =
      femaleProfile.approval_status === "approved" &&
      femaleProfile.account_status === "active";

    // If marked as AI managed and eligible
    if (femaleProfile.is_ai_managed === true && isApprovedAndActive) {
      // Check if there is an explicit ai_personas override row for custom models/prompts
      const { data: personaOverride } = await supabase
        .from("ai_personas")
        .select("id, persona_code, system_prompt, model_name, temperature, max_tokens, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      return {
        id: personaOverride?.id || femaleProfile.id,
        user_id: femaleProfile.user_id,
        persona_code: personaOverride?.persona_code || `ai_${femaleProfile.user_id.slice(0, 8)}`,
        display_name: femaleProfile.full_name || "Companion",
        age: femaleProfile.age,
        bio: femaleProfile.bio,
        country: femaleProfile.country,
        state: femaleProfile.state,
        city: null,
        primary_language: femaleProfile.primary_language,
        preferred_language: femaleProfile.preferred_language,
        interests: femaleProfile.interests,
        occupation: femaleProfile.occupation,
        system_prompt: personaOverride?.system_prompt,
        model_name: personaOverride?.model_name || "qwen3:4b",
        temperature: Number(personaOverride?.temperature ?? 0.7),
        max_tokens: Number(personaOverride?.max_tokens ?? 180),
      };
    }
  }

  // Query 2: Legacy fallback to ai_personas table (guarantees Aarya or legacy personas continue functioning)
  const { data: legacyPersona, error: personaError } = await supabase
    .from("ai_personas")
    .select("id, user_id, persona_code, display_name, system_prompt, model_name, temperature, max_tokens, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (personaError || !legacyPersona) {
    return null;
  }

  // Fetch complementary profile data if available
  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_language, preferred_language, bio, state, country, age, interests")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    id: legacyPersona.id,
    user_id: legacyPersona.user_id,
    persona_code: legacyPersona.persona_code,
    display_name: legacyPersona.display_name,
    system_prompt: legacyPersona.system_prompt,
    model_name: legacyPersona.model_name || "qwen3:4b",
    temperature: Number(legacyPersona.temperature ?? 0.7),
    max_tokens: Number(legacyPersona.max_tokens ?? 180),
    primary_language: profile?.primary_language,
    preferred_language: (profile as any)?.preferred_language,
    bio: profile?.bio,
    state: profile?.state,
    country: profile?.country,
    age: (profile as any)?.age,
    interests: (profile as any)?.interests,
  };
}

/**
 * Atomically acquires a job lock in `public.ai_message_jobs`.
 * Decoupled from ai_personas ID: uses recipient_id / persona_id safely.
 * Returns true if this worker won the lock, false if already claimed/processed.
 */
export async function claimMessageJob(
  supabase: SupabaseClient,
  messageId: string,
  chatId: string,
  recipientUserId: string,
  senderId: string,
): Promise<boolean> {
  const insertPayload: Record<string, any> = {
    message_id: messageId,
    chat_id: chatId,
    sender_id: senderId,
    status: "processing",
  };

  // If the schema has recipient_id, supply it; also provide persona_id if it requires a UUID
  insertPayload.persona_id = recipientUserId;
  insertPayload.recipient_id = recipientUserId;

  const { error } = await supabase.from("ai_message_jobs").insert(insertPayload);

  if (!error) {
    return true; // Successfully acquired job lock
  }

  // If unique constraint violation on message_id, job already exists.
  const { data: existing } = await supabase
    .from("ai_message_jobs")
    .select("id, status, retry_count, updated_at")
    .eq("message_id", messageId)
    .maybeSingle();

  if (!existing) return false;

  // If job failed with retry_count < 3, reclaim it
  if (existing.status === "failed" && existing.retry_count < 3) {
    const { error: updateErr } = await supabase
      .from("ai_message_jobs")
      .update({
        status: "processing",
        retry_count: existing.retry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("status", "failed");

    return !updateErr;
  }

  return false;
}

/**
 * Main execution unit to process an incoming message for any eligible AI profile
 */
export async function processIncomingAiMessage(
  params: ProcessIncomingMessageParams,
): Promise<ProcessResult> {
  const { messageId, chatId, senderId, receiverId, messageText, supabase, ollamaBaseUrl, modelOverride } = params;

  // 1. Guard against self-messages (prevent loops)
  if (senderId === receiverId) {
    return { status: "skipped", reason: "Sender is same as receiver" };
  }

  // 2. Guard against empty/unsupported message text
  if (!messageText || typeof messageText !== "string" || !messageText.trim()) {
    return { status: "skipped", reason: "Message is empty or unsupported" };
  }

  // 3. Dynamically identify if receiver is an active, eligible AI-managed female profile
  const persona = await getActivePersonaForUser(supabase, receiverId);
  if (!persona) {
    return { status: "skipped", reason: "Receiver is not an active AI persona" };
  }

  // 4. Atomically claim the message job to guarantee idempotency and prevent duplicates
  const claimed = await claimMessageJob(supabase, messageId, chatId, persona.user_id, senderId);
  if (!claimed) {
    return { status: "skipped", reason: "Job already claimed or completed" };
  }

  // 5. Send typing indicator via Supabase Realtime broadcast channel
  const presenceChannel = supabase.channel(`chat-presence:${chatId}`);
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 3000);
      presenceChannel.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await presenceChannel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: receiverId, typing: true },
    });
  } catch (err) {
    console.warn("[AI Worker] Failed to send typing broadcast:", err);
  }

  try {
    // 6. Fetch recent chat history for context
    const { data: rawMessages } = await supabase
      .from("chat_messages")
      .select("id, sender_id, receiver_id, message, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = formatConversationHistory(
      (rawMessages || []) as MessageRecord[],
      persona.user_id,
      8,
    );

    // If latest incoming message wasn't in DB yet when queried, append it
    if (!history.some((h) => h.content === messageText.trim())) {
      history.push({ role: "user", content: messageText.trim() });
    }

    // 7. Build individualized system prompt & call Ollama
    const systemPrompt = buildSystemPrompt(persona);
    const ollamaResponse = await generateOllamaReply(
      {
        model: modelOverride || persona.model_name || "qwen3:4b",
        systemPrompt,
        messages: history,
        temperature: persona.temperature,
        maxTokens: persona.max_tokens,
      },
      ollamaBaseUrl,
    );

    const replyText = ollamaResponse.reply.trim();
    if (!replyText) {
      throw new Error("Ollama returned an empty response");
    }

    // 8. Insert reply into chat_messages strictly under the female profile's user_id
    const { data: insertedMsg, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        sender_id: persona.user_id,
        receiver_id: senderId,
        message: replyText,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    // 9. Mark job as completed
    await supabase
      .from("ai_message_jobs")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", messageId);

    return {
      status: "processed",
      replyId: insertedMsg.id,
      replyText,
    };
  } catch (error: any) {
    console.error("[AI Worker] Error processing message:", error);

    // Update job as failed with error details
    await supabase
      .from("ai_message_jobs")
      .update({
        status: "failed",
        error_message: String(error?.message || error),
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", messageId);

    return {
      status: "failed",
      reason: String(error?.message || error),
    };
  } finally {
    // Clear typing indicator
    try {
      await presenceChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: receiverId, typing: false },
      });
      await supabase.removeChannel(presenceChannel);
    } catch {
      /* ignore cleanup error */
    }
  }
}
