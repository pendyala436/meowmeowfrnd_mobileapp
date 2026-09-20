/**
 * Surfaces incoming friend requests with a toast + Accept/Reject actions.
 * Works via realtime on user_friends (and notifications when migration is applied).
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function useFriendRequestAlerts(
  currentUserId: string | null,
  options?: { onOpenFriends?: () => void }
) {
  const { toast } = useToast();
  const seenRef = useRef<Set<string>>(new Set());
  const onOpenFriends = options?.onOpenFriends;

  useEffect(() => {
    if (!currentUserId) return;

    const handleIncoming = async (requestId: string, fromUserId: string) => {
      if (!requestId || seenRef.current.has(requestId)) return;
      seenRef.current.add(requestId);

      let fromName = "Someone";
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", fromUserId)
          .maybeSingle();
        if (data?.full_name) fromName = data.full_name;
      } catch {
        /* ignore */
      }

      toast({
        title: "Friend Request",
        description: `${fromName} sent you a friend request.`,
        duration: 14000,
        action: (
          <ToastAction
            altText="Accept"
            onClick={async () => {
              try {
                const { data, error } = await supabase.rpc("accept_friend_request", {
                  p_request_id: requestId,
                });
                if (error) throw error;
                const result = data as { success?: boolean; error?: string };
                if (result && result.success === false) {
                  toast({ title: "Could not accept", description: result.error, variant: "destructive" });
                  return;
                }
                toast({ title: "Friend Added!", description: `You are now friends with ${fromName}.` });
              } catch (e: any) {
                toast({
                  title: "Could not accept",
                  description: e?.message || "Open Friends to manage the request.",
                  variant: "destructive",
                });
                onOpenFriends?.();
              }
            }}
          >
            Accept
          </ToastAction>
        ),
      });
    };

    const channel = supabase
      .channel(`friend-alerts-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_friends",
          filter: `friend_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; user_id?: string; status?: string };
          if (row?.status === "pending" && row.id && row.user_id) {
            void handleIncoming(row.id, row.user_id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const n = payload.new as { type?: string; action_url?: string; message?: string };
          if (n?.type !== "friend_request") return;
          const match = n.action_url?.match(/request=([0-9a-f-]{36})/i);
          if (match?.[1]) {
            // Name already in message; open friends if they dismiss without action
            // Prefer user_friends path for Accept; this is a backup alert.
            toast({
              title: "Friend Request",
              description: n.message || "You have a new friend request.",
              duration: 10000,
              action: (
                <ToastAction altText="View" onClick={() => onOpenFriends?.()}>
                  View
                </ToastAction>
              ),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, toast, onOpenFriends]);
}
