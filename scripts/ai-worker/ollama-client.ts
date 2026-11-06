/**
 * Ollama Client for Meow Meow AI Personas
 *
 * Calls Ollama `/api/chat` with configurable model, prompt, and parameters.
 * Strips reasoning tokens (e.g. `<think>...</think>` from DeepSeek/Qwen thinking tags)
 * so internal chain-of-thought is never leaked to end users.
 */

export interface ChatMessageContext {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaGenerateOptions {
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface OllamaResponse {
  reply: string;
  totalDurationMs?: number;
  tokensGenerated?: number;
}

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen3:4b";
const DEFAULT_TIMEOUT_MS = 45000;

/**
 * Strips chain-of-thought/internal reasoning tags (like `<think>...</think>`)
 * from models that output reasoning before final answer.
 */
export function sanitizeModelOutput(text: string): string {
  if (!text) return "";
  // Strip <think>...</think> blocks including multi-line
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Strip unmatched dangling <think> tag if output was cut off
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");
  // Clean leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Call Ollama API with structured messages and robust timeout
 */
export async function generateOllamaReply(
  options: OllamaGenerateOptions,
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaResponse> {
  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/chat`;

  const payload = {
    model,
    messages: [
      { role: "system", content: options.systemPrompt },
      ...options.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 200,
    },
  };

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Ollama request failed with HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawReply = data?.message?.content || "";
    const sanitized = sanitizeModelOutput(rawReply);

    return {
      reply: sanitized,
      totalDurationMs: Date.now() - startTime,
      tokensGenerated: data?.eval_count,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Ollama generation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutTimer);
  }
}
