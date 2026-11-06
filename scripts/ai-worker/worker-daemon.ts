/**
 * Meow Meow Asynchronous AI Persona Worker Daemon
 *
 * Runs on the VPS alongside Ollama.
 * Subscribes in realtime to `chat_messages` INSERT events using Supabase Service Role Key.
 * Dispatches matching messages to `processIncomingAiMessage` with bounded concurrency.
 *
 * Usage:
 *   bun scripts/ai-worker/worker-daemon.ts
 *   or
 *   node --loader ts-node/esm scripts/ai-worker/worker-daemon.ts
 */

import { createClient } from "@supabase/supabase-js";
import { processIncomingAiMessage } from "./message-processor";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "3", 10);

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

console.log("[AI Worker] Starting Meow Meow AI Persona Worker Daemon...");
console.log(`[AI Worker] Connected to Supabase at: ${SUPABASE_URL}`);
console.log(`[AI Worker] Using Ollama at: ${OLLAMA_BASE_URL} (max concurrency: ${MAX_CONCURRENT_JOBS})`);

// Subscribe to new chat_messages across all chats
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

// Handle graceful termination
process.on("SIGINT", async () => {
  console.log("\n[AI Worker] Received SIGINT. Unsubscribing and shutting down...");
  await supabase.removeChannel(channel);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[AI Worker] Received SIGTERM. Unsubscribing and shutting down...");
  await supabase.removeChannel(channel);
  process.exit(0);
});
