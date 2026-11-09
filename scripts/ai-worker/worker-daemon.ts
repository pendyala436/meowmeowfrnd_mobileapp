/**
 * Meow Meow Asynchronous AI Persona Worker Daemon
 *
 * Runs on the VPS alongside Ollama.
 * 1. Subscribes in realtime to `chat_messages` INSERT events using Supabase Service Role Key.
 * 2. Periodically runs the Proactive Conversation & Engagement scheduler loop.
 *
 * Concurrency is bounded to keep memory and CPU low on the host.
 */

import { createClient } from "@supabase/supabase-js";
import { processIncomingAiMessage } from "./message-processor.js";
import {
  runProactiveSchedulerCycle,
  runOpportunityDiscoveryCycle,
} from "./proactive-service.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10);
const PROACTIVE_POLL_INTERVAL_MS = parseInt(process.env.PROACTIVE_POLL_INTERVAL_MS || "60000", 10); // 1 minute
const DISCOVERY_POLL_INTERVAL_MS = parseInt(process.env.DISCOVERY_POLL_INTERVAL_MS || "300000", 10); // 5 minutes
const PRESENCE_HEARTBEAT_INTERVAL_MS = 60000; // 1 minute presence heartbeat for AI profiles

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[AI Worker FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let activeJobCount = 0;
const jobQueue: Array<() => Promise<void>> = [];

function pumpQueue() {
  while (activeJobCount < MAX_CONCURRENT_JOBS && jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (job) {
      activeJobCount++;
      job().finally(() => {
        activeJobCount--;
        pumpQueue();
      });
    }
  }
}

function enqueueJob(task: () => Promise<void>) {
  jobQueue.push(task);
  pumpQueue();
}

console.log("[AI Worker] Starting Meow Meow AI Persona Worker Daemon (v2.5.0)...");
console.log(`[AI Worker] Connected to Supabase at: ${SUPABASE_URL}`);
console.log(`[AI Worker] Using Ollama at: ${OLLAMA_BASE_URL} (max concurrency: ${MAX_CONCURRENT_JOBS})`);

// 1. Subscribe to new incoming chat_messages across all chats
const channel = supabase
  .channel("ai-worker-chat-messages")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "chat_messages",
    },
    async (payload) => {
      const msg = payload.new as {
        id: string;
        chat_id: string;
        sender_id: string;
        receiver_id: string;
        message: string;
      };

      if (!msg || !msg.id || !msg.receiver_id) return;

      enqueueJob(async () => {
        try {
          const res = await processIncomingAiMessage({
            messageId: msg.id,
            chatId: msg.chat_id,
            senderId: msg.sender_id,
            receiverId: msg.receiver_id,
            messageText: msg.message,
            supabase,
            ollamaBaseUrl: OLLAMA_BASE_URL,
          });

          if (res.status === "processed") {
            console.log(`[AI Worker] Successfully generated reply for chat ${msg.chat_id}`);
          }
        } catch (err) {
          console.error(`[AI Worker] Error handling message ${msg.id}:`, err);
        }
      });
    },
  )
  .subscribe((status) => {
    console.log(`[AI Worker] Realtime subscription status: ${status}`);
  });

// 2. Periodic Proactive Engagement Scheduler & Autonomous Discovery
let proactiveSchedulerTimer: NodeJS.Timeout | null = null;
let discoveryTimer: NodeJS.Timeout | null = null;
let presenceHeartbeatTimer: NodeJS.Timeout | null = null;
let isProactiveCycleRunning = false;
let isDiscoveryRunning = false;
let isPresenceHeartbeatRunning = false;

/**
 * Periodic presence heartbeat for approved, active AI-managed profiles.
 * Ensures Aarya and dynamic AI profiles have fresh `last_seen` timestamps and `is_online = true`.
 */
async function executePresenceHeartbeat() {
  if (isPresenceHeartbeatRunning) return;
  isPresenceHeartbeatRunning = true;
  try {
    const { data: aiProfiles } = await supabase
      .from("female_profiles")
      .select("user_id")
      .eq("is_ai_managed", true)
      .eq("approval_status", "approved")
      .eq("account_status", "active");

    const ids = (aiProfiles || []).map((p) => p.user_id);
    if (ids.length > 0) {
      await supabase
        .from("user_status")
        .update({
          is_online: true,
          keep_online: true,
          last_seen: new Date().toISOString(),
          status_text: "Available",
        })
        .in("user_id", ids);
    }
  } catch (err) {
    console.error("[AI Worker] Error updating AI presence heartbeat:", err);
  } finally {
    isPresenceHeartbeatRunning = false;
  }
}

async function executeProactiveCycle() {
  if (isProactiveCycleRunning || activeJobCount >= MAX_CONCURRENT_JOBS) {
    return;
  }
  isProactiveCycleRunning = true;
  try {
    const result = await runProactiveSchedulerCycle(supabase, 2, OLLAMA_BASE_URL);
    if (result.processed > 0) {
      console.log(
        `[Proactive Scheduler] Cycle complete: processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`,
      );
    }
  } catch (err) {
    console.error("[Proactive Scheduler] Error during cycle execution:", err);
  } finally {
    isProactiveCycleRunning = false;
  }
}

async function executeDiscoveryCycle() {
  if (isDiscoveryRunning || activeJobCount >= MAX_CONCURRENT_JOBS) {
    return;
  }
  isDiscoveryRunning = true;
  try {
    const res = await runOpportunityDiscoveryCycle(supabase, 10);
    if (res.opportunitiesFound > 0) {
      console.log(
        `[Opportunity Discovery] Evaluated ${res.evaluated} users, discovered ${res.opportunitiesFound} opportunities, scheduled ${res.jobsCreated} jobs`,
      );
    }
  } catch (err) {
    console.error("[Opportunity Discovery] Error during discovery cycle:", err);
  } finally {
    isDiscoveryRunning = false;
  }
}

// Start bounded proactive poll interval and opportunity discovery
proactiveSchedulerTimer = setInterval(executeProactiveCycle, PROACTIVE_POLL_INTERVAL_MS);
discoveryTimer = setInterval(executeDiscoveryCycle, DISCOVERY_POLL_INTERVAL_MS);
presenceHeartbeatTimer = setInterval(executePresenceHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);
console.log(`[AI Worker] Proactive engagement scheduler initialized (interval: ${PROACTIVE_POLL_INTERVAL_MS}ms)`);
console.log(`[AI Worker] Autonomous opportunity discovery engine initialized (interval: ${DISCOVERY_POLL_INTERVAL_MS}ms)`);
console.log(`[AI Worker] AI presence heartbeat initialized (interval: ${PRESENCE_HEARTBEAT_INTERVAL_MS}ms)`);

// Run an initial presence update immediately and discovery pass after brief 10s warmup
executePresenceHeartbeat();
setTimeout(executeDiscoveryCycle, 10000);

// 3. Graceful termination
function shutdown() {
  console.log("\n[AI Worker] Shutting down daemon...");
  if (proactiveSchedulerTimer) {
    clearInterval(proactiveSchedulerTimer);
  }
  if (discoveryTimer) {
    clearInterval(discoveryTimer);
  }
  if (presenceHeartbeatTimer) {
    clearInterval(presenceHeartbeatTimer);
  }
  supabase.removeChannel(channel).finally(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
