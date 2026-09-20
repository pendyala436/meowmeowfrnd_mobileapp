/**
 * Helper types for Supabase query results that lose type inference
 * when put into Maps or used with complex query patterns.
 */

/** Realtime postgres_changes callback payload (supabase client may be loosely typed). */
export interface RealtimeChangePayload<T = Record<string, unknown>> {
  eventType?: string;
  new: T;
  old?: Partial<T>;
}

export interface ProfileQueryResult {
  user_id: string;
  full_name: string | null;
  photo_url: string | null;
  primary_language: string | null;
  preferred_language?: string | null;
  gender?: string | null;
  age?: number | null;
  country?: string | null;
  is_indian?: boolean | null;
  is_earning_eligible?: boolean | null;
  ai_approved?: boolean | null;
  approval_status?: string;
}

export interface AvailabilityQueryResult {
  user_id: string;
  is_available: boolean;
  current_chat_count: number;
  max_concurrent_chats: number;
}

export interface WalletQueryResult {
  user_id: string;
  balance: number;
}

export interface StatusQueryResult {
  user_id: string;
  is_online: boolean;
  last_seen?: string | null;
}

/** chat_messages row fields commonly read from realtime payloads. */
export interface ChatMessageRow {
  id: string;
  chat_id?: string;
  sender_id: string;
  receiver_id?: string | null;
  message: string | null;
  created_at: string;
  is_read?: boolean | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  translated_message?: string | null;
  english_text?: string | null;
  deleted_for_everyone?: boolean | null;
  deleted_for_sender?: boolean | null;
  deleted_for_receiver?: boolean | null;
}

/** Active chat / call session fields from realtime payloads. */
export interface ChatSessionRow {
  id: string;
  chat_id?: string;
  status?: string | null;
  man_user_id?: string;
  woman_user_id?: string;
  started_at?: string | null;
  ended_at?: string | null;
  updated_at?: string | null;
  created_at?: string;
  end_reason?: string | null;
}

/** Video/audio call row from realtime payloads. */
export interface CallRow {
  id: string;
  call_id?: string;
  status?: string | null;
  call_type?: string | null;
  caller_id?: string;
  receiver_id?: string;
  man_user_id?: string;
  woman_user_id?: string;
  started_at?: string | null;
  created_at?: string;
}

/** Gender verification AI result shape. */
export interface VerificationResult {
  detectedGender?: string;
  confidence?: number;
  reason?: string;
}

/** Loose row from a Supabase select that lost inference (Maps, Promise.all, etc.). */
export type LooseRow = Record<string, unknown>;

/** Broadcast / postgres_changes handler payload with optional nested payload. */
export interface RealtimeBroadcastPayload<T = Record<string, unknown>> {
  payload?: T;
  event?: string;
  type?: string;
  [key: string]: unknown;
}

/** Chromium / Safari navigator extensions used for device capability checks. */
export interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  brave?: { isBrave?: () => Promise<boolean> };
}

export interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}
