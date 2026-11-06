# Meow Meow AI Persona Worker

Asynchronous worker daemon that listens to incoming messages for AI personas via Supabase Realtime, generates replies using the local Ollama instance (`qwen3:4b`), and persists responses into `public.chat_messages`.

## Components

- **`ollama-client.ts`**: HTTP client for Ollama `/api/chat` with timeout and `<think>...</think>` reasoning token sanitization.
- **`prompt-builder.ts`**: Builds persona-specific system prompts with virtual companion disclaimers and structures recent conversation history.
- **`message-processor.ts`**: State machine and atomic job lock mechanism with `public.ai_message_jobs` to prevent duplicate generation and self-reply loops.
- **`worker-daemon.ts`**: Standalone daemon process with bounded concurrency (`MAX_CONCURRENT_JOBS`) and Supabase Realtime connection.

## Environment Variables

```env
SUPABASE_URL="https://www.meow-meow.co.in:8443"
SUPABASE_SERVICE_ROLE_KEY="<YOUR_SERVICE_ROLE_KEY>"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen3:4b"
MAX_CONCURRENT_JOBS=3
```

## Running on Ubuntu VPS

```bash
# Using Bun:
bun run scripts/ai-worker/worker-daemon.ts

# Or with systemd:
# Create /etc/systemd/system/meow-ai-worker.service
```
