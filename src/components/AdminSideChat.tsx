/**
 * AdminSideChat — admin-facing 1-to-1 chat panel for /admin/messenger.
 * Mirrors UserAdminChat but inserts messages with sender_role='admin'.
 * Audio/video call buttons place a free admin→woman call (billing bypass).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Shield, User, Phone, Video } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useAppCall } from "@/hooks/useAppCall";
import { CallScreen } from "@/components/CallScreen";

interface Msg {
  id: string;
  sender_role: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface Props {
  adminId: string;
  targetUserId: string;
  targetUserName: string;
}

export function AdminSideChat({ adminId, targetUserId, targetUserName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [targetGender, setTargetGender] = useState<string | null>(null);
  const [targetPhoto, setTargetPhoto] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const {
    status: callStatus,
    activeCall,
    isMuted,
    isCameraOff,
    initiateCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useAppCall(adminId, "male", 0, { isAdmin: true });

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("admin_user_messages")
      .select("id, sender_role, sender_id, message, created_at")
      .eq("target_user_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data as Msg[]);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gender, photo_url")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (cancelled) return;
      setTargetGender((data?.gender || "").toLowerCase() || null);
      setTargetPhoto(data?.photo_url || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  useEffect(() => {
    fetchMessages();
    const ch = supabase
      .channel(`admin-side-chat-${targetUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_user_messages",
          filter: `target_user_id=eq.${targetUserId}`,
        },
        () => fetchMessages(),
      )
      .subscribe();
    // mark inbound as read
    supabase
      .from("admin_user_messages")
      .update({ is_read: true })
      .eq("target_user_id", targetUserId)
      .eq("sender_role", "user")
      .eq("is_read", false)
      .then(() => {});
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mount/effect deps; adding would remount chat/billing/call loops
  }, [targetUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("admin_user_messages").insert({
        admin_id: adminId,
        target_group: "direct",
        target_user_id: targetUserId,
        sender_role: "admin",
        sender_id: adminId,
        message: text.trim(),
      });
      if (error) throw error;
      setText("");
      fetchMessages();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  const canCallWoman = targetGender === "female";
  const startCall = (type: "audio" | "video") => {
    if (!canCallWoman) {
      toast.info("Admin audio/video calls are available to women (including TL).");
      return;
    }
    void initiateCall(targetUserId, targetUserName, targetPhoto, type);
  };

  const inCall = callStatus !== "idle" && callStatus !== "ended" && !!activeCall;

  return (
    <div className="flex flex-col h-[65vh]">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{targetUserName}</p>
            <p className="text-[10px] text-muted-foreground">Admin (free — bypass billing)</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/15"
            title={canCallWoman ? "Audio call (free)" : "Audio calls available for women / TL"}
            disabled={!canCallWoman || inCall}
            onClick={() => startCall("audio")}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/15"
            title={canCallWoman ? "Video call (free)" : "Video calls available for women / TL"}
            disabled={!canCallWoman || inCall}
            onClick={() => startCall("video")}
          >
            <Video className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">No messages yet.</div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[85%] p-2 rounded-xl text-xs",
                m.sender_role === "admin"
                  ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                  : "mr-auto bg-muted rounded-bl-sm",
              )}
            >
              {m.sender_role === "admin" && (
                <p className="text-[10px] font-semibold mb-0.5 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Admin (you)
                </p>
              )}
              <p className="break-words whitespace-pre-wrap">{m.message}</p>
              <p className="text-[9px] opacity-60 mt-1">
                {format(new Date(m.created_at), "MMM dd, HH:mm")}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <div className="p-2 border-t border-border flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply as Admin…"
          rows={1}
          className="resize-none flex-1 min-h-[36px] max-h-[72px] text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" className="shrink-0" onClick={send} disabled={!text.trim() || sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {inCall && (
        <CallScreen
          status={callStatus}
          activeCall={activeCall}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          onEnd={() => {
            endCall();
          }}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          userGender="male"
          partnerUserId={targetUserId}
          senderName="Admin"
          currentUserId={adminId}
        />
      )}
    </div>
  );
}
