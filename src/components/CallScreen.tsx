import type { RealtimeChangePayload, ChatMessageRow } from "@/types/supabase-helpers";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { ActiveCall, CallStatus } from "@/hooks/useAppCall";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { SendGiftButton } from "@/components/SendGiftButton";
import { startRingLoop, stopRingLoop } from "@/hooks/useIncomingCalls";
import { playMedia } from "@/lib/media";
import { createAnimatedGift, parseGiftMessage, type AnimatedGift } from "@/lib/gift-message";
import { supabase } from "@/integrations/supabase/client";

interface CallScreenProps {
  status: CallStatus;
  activeCall: ActiveCall | null;
  isMuted: boolean;
  isCameraOff: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  userGender?: "male" | "female";
  chatId?: string;
  partnerUserId?: string;
  senderName?: string;
  currentUserId?: string;
  /** Force-hide Cost/Earned (admin free calls). */
  isFreeCall?: boolean;
}

// Per-minute rates (synced with chat_pricing defaults)
const RATES = {
  audio: { male: 6, female: 3 },
  video: { male: 8, female: 4 },
} as const;

export const CallScreen = ({
  status,
  activeCall,
  isMuted,
  isCameraOff,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  userGender = "male",
  chatId,
  partnerUserId,
  senderName = "You",
  currentUserId,
  isFreeCall = false,
}: CallScreenProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [animatedGifts, setAnimatedGifts] = useState<AnimatedGift[]>([]);
  const [remoteIsAdmin, setRemoteIsAdmin] = useState(false);

  // Callee may not get isFreeCall from ActiveCall if role lookup failed — resolve via RPC.
  useEffect(() => {
    if (isFreeCall || activeCall?.isFreeCall) {
      setRemoteIsAdmin(true);
      return;
    }
    const remoteId = activeCall?.remoteUserId;
    if (!remoteId) {
      setRemoteIsAdmin(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.rpc("has_role", {
          _user_id: remoteId,
          _role: "admin",
        });
        if (!cancelled) setRemoteIsAdmin(!!data);
      } catch {
        if (!cancelled) setRemoteIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFreeCall, activeCall?.isFreeCall, activeCall?.remoteUserId]);

  const hideBilling =
    isFreeCall ||
    !!activeCall?.isFreeCall ||
    remoteIsAdmin ||
    activeCall?.remoteName?.trim().toLowerCase() === "admin";

  const addAnimatedGift = useCallback(
    (parsed: { emoji: string; name: string; senderName: string }) => {
      const gift = createAnimatedGift({ ...parsed, price: 0 });
      setAnimatedGifts((prev) => [...prev, gift]);
      window.setTimeout(() => {
        setAnimatedGifts((prev) => prev.filter((g) => g.id !== gift.id));
      }, 3500);
    },
    [],
  );

  useEffect(() => {
    const onGift = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        emoji: string;
        name: string;
        senderName: string;
      };
      if (detail?.emoji) addAnimatedGift(detail);
    };
    window.addEventListener("meow-call-gift", onGift);
    return () => window.removeEventListener("meow-call-gift", onGift);
  }, [addAnimatedGift]);

  useEffect(() => {
    if (!chatId || status !== "active") return;
    const channel = supabase
      .channel(`call-gifts-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload: RealtimeChangePayload<ChatMessageRow>) => {
          const parsed = parseGiftMessage(payload.new?.message || "");
          if (parsed) addAnimatedGift(parsed);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, status, addAnimatedGift]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && activeCall?.localStream) {
      el.srcObject = activeCall.localStream;
      el.muted = true;
      void playMedia(el);
    }
  }, [activeCall?.localStream]);

  useEffect(() => {
    if (!activeCall?.remoteStream) return;
    if (activeCall.callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
      void playMedia(remoteVideoRef.current);
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = activeCall.remoteStream;
      void playMedia(remoteAudioRef.current);
    }
  }, [activeCall?.remoteStream, activeCall?.callType]);

  useEffect(() => {
    if (status !== "active") {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === "calling" || status === "ringing") {
      startRingLoop();
    } else {
      stopRingLoop();
    }
    return () => stopRingLoop();
  }, [status]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!activeCall || status === "idle" || status === "ended") return null;

  const isVideo = activeCall.callType === "video";
  const isRinging = status === "ringing";
  const isCalling = status === "calling";
  const isActive = status === "active";
  const showVideoBackground = isVideo && !!activeCall.remoteStream;

  // Portal to body so hang-up works even when CallScreen is mounted inside a
  // Dialog (translate) or overflow-hidden card — those trap position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col text-foreground">
      {showVideoBackground && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {!showVideoBackground && (
        <div className="absolute inset-0 bg-gradient-to-b from-primary via-background to-primary/70" />
      )}

      {showVideoBackground && (
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/80 to-transparent pointer-events-none z-10" />
      )}

      {animatedGifts.map((gift) => (
        <div
          key={gift.id}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none animate-gift-entrance"
        >
          <div className="flex flex-col items-center gap-2 animate-gift-pulse">
            <span className="text-8xl drop-shadow-2xl">{gift.emoji}</span>
            <div className="bg-card/70 backdrop-blur-md rounded-2xl px-5 py-2 text-center">
              <p className="text-foreground font-bold text-lg">{gift.senderName}</p>
              <p className="text-accent text-sm font-medium">sent {gift.name}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="relative z-10 flex flex-col items-center pt-[max(env(safe-area-inset-top),2rem)] px-4">
        <Avatar className="h-24 w-24 border-4 border-primary-foreground/20 shadow-2xl mb-4">
          <AvatarImage src={activeCall.remotePhoto || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
            {activeCall.remoteName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h2 className="text-foreground text-2xl font-semibold mb-1">{activeCall.remoteName}</h2>

        <p className="text-muted-foreground text-sm mb-2">
          {isCalling && "Ringing..."}
          {isRinging && (isVideo ? "Incoming video call" : "Incoming audio call")}
          {status === "connecting" && "Connecting..."}
          {isActive && fmtDuration(elapsed)}
        </p>

        {isActive &&
          !hideBilling &&
          (() => {
            const rate = RATES[activeCall.callType][userGender];
            const amount = (rate / 60) * elapsed;
            const isMan = userGender === "male";
            return (
              <div className="flex flex-col items-center gap-1">
                <span className="px-2 py-0.5 rounded-full bg-card/80 text-muted-foreground text-xs border border-border">
                  {isMan ? "Cost" : "Earned"}: ₹{amount.toFixed(2)} · ₹{rate}/min
                </span>
              </div>
            );
          })()}
      </div>

      {isVideo && activeCall.localStream && (
        <div className="absolute bottom-36 right-4 z-20 w-28 h-40 rounded-xl overflow-hidden border-2 border-border shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
          />
          {isCameraOff && (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 mt-auto pb-[max(env(safe-area-inset-bottom),2rem)] px-6">
        {isRinging && !activeCall.isInitiator && (
          <div className="flex justify-around items-center">
            <button
              type="button"
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-destructive-foreground" />
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-success flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Phone className="w-7 h-7 text-success-foreground" />
            </button>
          </div>
        )}

        {isCalling && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onEnd}
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-destructive-foreground" />
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex justify-around items-center">
            <CallControlButton
              icon={isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              label={isMuted ? "Unmute" : "Mute"}
              active={isMuted}
              onPress={onToggleMute}
            />

            {isVideo && (
              <CallControlButton
                icon={
                  isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />
                }
                label={isCameraOff ? "Camera off" : "Camera"}
                active={isCameraOff}
                onPress={onToggleCamera}
              />
            )}

            <CallControlButton
              icon={<Volume2 className="w-6 h-6" />}
              label="Speaker"
              onPress={() => {}}
            />

            {userGender === "male" && (activeCall.remoteUserId || partnerUserId) && (
              <SendGiftButton
                recipientUserId={activeCall.remoteUserId || partnerUserId!}
                context={isVideo ? "video_call" : "audio_call"}
                variant="control"
                chatId={chatId}
                senderName={senderName}
                onGiftSent={(gift) =>
                  addAnimatedGift({ emoji: gift.emoji, name: gift.name, senderName })
                }
              />
            )}

            <button
              type="button"
              onClick={onEnd}
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-destructive-foreground" />
            </button>
          </div>
        )}

        {status === "connecting" && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onEnd}
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-destructive-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const CallControlButton = ({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}) => (
  <button
    onClick={onPress}
    className={cn(
      "flex flex-col items-center gap-1 p-3 rounded-full transition-colors border border-border/40",
      active ? "bg-primary/30 text-foreground" : "bg-card/80 text-foreground",
    )}
  >
    <span>{icon}</span>
    <span className="text-muted-foreground text-[10px]">{label}</span>
  </button>
);

export default CallScreen;
