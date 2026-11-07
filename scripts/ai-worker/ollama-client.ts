/**
 * Ollama Client for Meow Meow AI Personas
 *
 * Calls Ollama `/api/chat` with configurable model, prompt, and generation parameters.
 * Strips reasoning tokens (e.g. `<think>...</think>`), stage directions, and unwanted
 * prefixes so clean, direct conversational replies are returned.
 *
 * Includes automatic retry with jittered backoff for network/transient failures.
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
  maxRetries?: number;
}

export interface OllamaResponse {
  reply: string;
  totalDurationMs?: number;
  tokensGenerated?: number;
}

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "phoebe-rp:latest";
const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * Strips chain-of-thought/internal reasoning tags (like `<think>...</think>`),
 * stage directions (e.g. `*smiles warmly*`), and role prefixes (e.g. `Priya:`).
 */
export function sanitizeModelOutput(text: string): string {
  if (!text) return "";

  // 1. Strip <think>...</think> blocks including multi-line
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Strip unmatched dangling <think> tag if output was cut off
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");

  // 2. Strip leading role prefixes like "Assistant:", "Priya:", "AI:", etc.
  cleaned = cleaned.replace(/^(?:(?:[A-Za-z0-9_\s]{2,20}):\s*)/i, (match) => {
    // Only strip if it looks like a prefix, e.g. "Maya: Hello"
    if (/^(?:assistant|ai|bot|meow|maya|priya|aarya|swathi|ananya|pooja):\s*/i.test(match)) {
      return "";
    }
    return match;
  });

  // 3. Strip outer quotes if the model wrapped the entire reply in quotation marks
  cleaned = cleaned.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 4. Clean leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Call Ollama API with structured messages, robust timeout, and transient retry support
 */
export async function generateOllamaReply(
  options: OllamaGenerateOptions,
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaResponse> {
  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
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
      num_predict: options.maxTokens ?? 150,
      top_p: 0.9,
    },
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

      if (!sanitized) {
        throw new Error("Ollama returned an empty response");
      }

      return {
        reply: sanitized,
        totalDurationMs: Date.now() - startTime,
        tokensGenerated: data?.eval_count,
      };
    } catch (error: any) {
      lastError = error?.name === "AbortError"
        ? new Error(`Ollama generation timed out after ${timeoutMs}ms`)
        : error;

      if (attempt < maxRetries) {
        // Exponential backoff with small jitter (e.g. 500ms, 1000ms)
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        await new Promise((res) => setTimeout(res, delay));
      }
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  throw lastError || new Error("Failed to generate response from Ollama");
}
