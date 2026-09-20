import type { CallRow } from "@/types/supabase-helpers";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IncomingCallEvent {
  callId: string;
  callType: "audio" | "video";
  callerUserId: string;
  callerName: string;
  callerPhoto: string | null;
}

const TERMINAL_STATUSES = [
  "ended",
  "declined",
  "missed",
  "completed",
  "timeout_cleanup",
  "cancelled",
];

export const useIncomingCallListener = (
  currentUserId: string | null,
  userGender: "male" | "female",
  _viewerLanguage?: string | null,
) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const incomingCallRef = useRef<IncomingCallEvent | null>(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (!currentUserId || userGender !== "female") return;

    const isTerminal = (status: string | null | undefined) =>
      TERMINAL_STATUSES.includes(String(status || "").toLowerCase());

    const dismissIfCurrent = (callId: string) => {
      if (incomingCallRef.current?.callId === callId) {
        setIncomingCall(null);
      }
    };

    const showIncoming = async (row: CallRow) => {
      if (!row?.call_id || row.status !== "ringing") return;
      if (incomingCallRef.current?.callId === (row.call_id ?? row.id)) return;

      // Skip ringing if either side has blocked the other
      try {
        const { data: blockHit } = await supabase
          .from("user_blocks")
          .select("id")
          .or(
            `and(blocked_by.eq.${currentUserId},blocked_user_id.eq.${row.man_user_id ?? ""}),and(blocked_by.eq.${row.man_user_id ?? ""},blocked_user_id.eq.${currentUserId})`,
          )
          .limit(1)
          .maybeSingle();
        if (blockHit) return;
      } catch {
        /* continue */
      }

      const { data: profile } = await supabase
        .from("male_profiles")
        .select("full_name, photo_url")
        .eq("user_id", row.man_user_id ?? "")
        .maybeSingle();

      setIncomingCall({
        callId: row.call_id ?? row.id,
        callType: (row.call_type as "audio" | "video") || "video",
        callerUserId: row.man_user_id ?? "",
        callerName: profile?.full_name || "Unknown",
        callerPhoto: profile?.photo_url || null,
      });
    };

    const channel = supabase
      .channel(`incoming:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_call_sessions",
          filter: `woman_user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const row = payload.new as CallRow;
          // DB trigger already enforced same-language. Do not hide the ring
          // behind a second client-side language fetch (stale male/female_profiles
          // used to drop Hindi–Hindi calls silently).
          await showIncoming(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_call_sessions",
          filter: `woman_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as CallRow;
          if (row?.call_id && isTerminal(row.status)) {
            dismissIfCurrent(row.call_id ?? row.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, userGender]);

  // While a banner is up, also listen on the call signalling channel and
  // poll the session row. Realtime UPDATE can miss; the caller hang-up must
  // still stop the ring immediately.
  useEffect(() => {
    const callId = incomingCall?.callId;
    if (!callId) return;

    const dismiss = () => {
      if (incomingCallRef.current?.callId === callId) {
        setIncomingCall(null);
      }
    };

    const sig = supabase
      .channel(`call:${callId}`)
      .on("broadcast", { event: "call_cancelled" }, dismiss)
      .on("broadcast", { event: "call_ended" }, dismiss)
      .on("broadcast", { event: "call_declined" }, dismiss)
      .subscribe();

    let cancelled = false;
    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("video_call_sessions")
        .select("status")
        .eq("call_id", callId)
        .maybeSingle();
      if (cancelled) return;
      const status = String(data?.status || "").toLowerCase();
      if (
        !data ||
        TERMINAL_STATUSES.includes(status) ||
        (status && status !== "ringing" && status !== "connecting")
      ) {
        dismiss();
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(sig);
    };
  }, [incomingCall?.callId]);

  const clearIncomingCall = () => setIncomingCall(null);

  return { incomingCall, clearIncomingCall };
};
