import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicProfiles } from "@/lib/profile-queries";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { UserContactCard } from "@/components/UserContactCard";
import {
  MessageCircle,
  Video,
  Phone,
  Users,
  Clock,
  IndianRupee,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Radio,
} from "lucide-react";

type HistoryType = "all" | "chat" | "audio" | "video" | "group" | "groupchat";

interface HistoryItem {
  id: string;
  type: "chat" | "audio" | "video" | "group" | "groupchat";
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  partnerAge?: number | null;
  partnerLanguage?: string | null;
  partnerState?: string | null;
  partnerCountry?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string;
  totalMinutes: number;
  /** For men: total charged (debit); for women: total earned (credit) */
  totalAmount: number;
  /** Gender-appropriate rate per minute */
  ratePerMinute: number;
  endReason?: string;
  groupName?: string;
  isIncoming?: boolean;
}

/** Pricing rates – men pay, women earn (must mirror DB get_unified_pricing()) */
const RATES = {
  chat: { man: 4, woman: 2 },
  audio: { man: 6, woman: 3 },
  video: { man: 8, woman: 4 },
  group: { man: 4, woman: 1 },
  groupchat: { man: 2, woman: 1 },
} as const;

const asList = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

const asRecord = (v: unknown): Record<string, any> | undefined => {
  if (!v) return undefined;
  if (Array.isArray(v)) return asRecord(v[0]);
  if (typeof v === "object") return v as Record<string, any>;
  return undefined;
};

const asText = (v: unknown, fallback: string): string => {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
};

const asNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Any leftover seconds (1–59) count as a full billed minute. */
const billedMinutes = (minutes: number): number => {
  const totalSecs = Math.max(0, Math.round(asNum(minutes) * 60));
  if (totalSecs <= 0) return 0;
  return Math.ceil(totalSecs / 60);
};

const sessionMinutes = (s: {
  total_minutes?: unknown;
  started_at?: string | null;
  ended_at?: string | null;
}) => {
  const stored = asNum(s.total_minutes);
  if (stored > 0) return billedMinutes(stored);
  if (s.started_at && s.ended_at) {
    const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    if (Number.isFinite(ms) && ms > 0) return billedMinutes(ms / 60000);
  }
  return 0;
};

const relativeTime = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
};

const formatDuration = (minutes: number): string => {
  const m = billedMinutes(minutes);
  return `${m} min`;
};

interface CallHistoryTabProps {
  currentUserId: string;
  userGender: "male" | "female";
}

export const CallHistoryTab: React.FC<CallHistoryTabProps> = ({ currentUserId, userGender }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<HistoryType>("all");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isMale = userGender === "male";

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const items: HistoryItem[] = [];

      // 1. Chat sessions
      const { data: chatSessions } = await supabase
        .from("active_chat_sessions")
        .select("*")
        .or(`man_user_id.eq.${currentUserId},woman_user_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .limit(50);

      // 2. Video call sessions
      const { data: videoSessions } = await supabase
        .from("video_call_sessions")
        .select("*")
        .or(`man_user_id.eq.${currentUserId},woman_user_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .limit(30);

      // 3. Group call participation — unified from wallet_transactions + archive
      //    (>3 month old records live in wallet_transactions_archive)
      const { data: groupTxs } = await supabase.rpc("get_user_group_call_history" as any, {
        p_user_id: currentUserId,
        p_is_male: isMale,
        p_limit: 50,
      });

      // 4. Group chat participation — include host earning from session
      const { data: gcRows } = await supabase
        .from("group_chat_participants")
        .select(
          "id, session_id, joined_at, left_at, total_seconds, total_billed, group_chat_sessions!inner(id, room_id, host_id, started_at, ended_at, total_host_earning, group_chat_rooms!inner(id, name, tree_type))",
        )
        .eq("user_id", currentUserId)
        .order("joined_at", { ascending: false })
        .limit(50);

      type SessionRow = {
        id: string;
        man_user_id: string;
        woman_user_id: string;
        rate_per_minute?: number;
        total_earned?: number;
        status?: string;
        started_at?: string;
        created_at?: string;
        ended_at?: string | null;
        end_reason?: string | null;
        call_type?: string;
      };
      type TxRow = { session_id: string | null; amount: number | null };
      const chats = asList(chatSessions as SessionRow[] | null);
      const videos = asList(videoSessions as SessionRow[] | null);
      const groupRows = asList(groupTxs as any[]);
      const groupChats = asList(gcRows as any[]);

      const sessionIds = [
        ...chats.map((s) => s.id).filter(Boolean),
        ...videos.map((s) => s.id).filter(Boolean),
      ] as string[];
      const amountBySession = new Map<string, number>();
      if (sessionIds.length > 0) {
        const { data: txs } = await supabase
          .from("wallet_transactions")
          .select("session_id, amount")
          .eq("user_id", currentUserId)
          .in("session_id", sessionIds);
        for (const tx of asList(txs as TxRow[] | null)) {
          if (!tx.session_id) continue;
          amountBySession.set(
            tx.session_id,
            (amountBySession.get(tx.session_id) || 0) + asNum(tx.amount),
          );
        }
      }

      // Collect partner IDs
      const partnerIds = new Set<string>();
      chats.forEach((s) => {
        const pid = s.man_user_id === currentUserId ? s.woman_user_id : s.man_user_id;
        if (pid) partnerIds.add(pid);
      });
      videos.forEach((s) => {
        const pid = s.man_user_id === currentUserId ? s.woman_user_id : s.man_user_id;
        if (pid) partnerIds.add(pid);
      });
      // (Group call partners are not direct 1:1; no extra partner IDs to fetch)

      // Batch fetch profiles
      const profileMap = new Map<
        string,
        {
          full_name: string;
          photo_url: string;
          age: number | null;
          language: string | null;
          state: string | null;
          country: string | null;
        }
      >();
      if (partnerIds.size > 0) {
        const publicProfiles = await fetchPublicProfiles(Array.from(partnerIds));
        asList(publicProfiles).forEach((p) =>
          profileMap.set(p.user_id, {
            full_name: p.full_name || "User",
            photo_url: p.photo_url || "",
            age: p.age ?? null,
            language: p.primary_language || p.preferred_language || p.language || null,
            state: p.state || p.city || null,
            country: p.country || null,
          }),
        );
      }

      // Map chat sessions — duration from wallet when billed (matches statement/billing)
      chats.forEach((s) => {
        const pid = s.man_user_id === currentUserId ? s.woman_user_id : s.man_user_id;
        if (!s.id || !pid) return;
        const profile = profileMap.get(pid);
        const rate = asNum(s.rate_per_minute) || (isMale ? RATES.chat.man : RATES.chat.woman);
        const fromWallet = amountBySession.get(s.id);
        const totalAmount =
          fromWallet ??
          (isMale ? sessionMinutes(s) * rate : asNum(s.total_earned) || sessionMinutes(s) * rate);
        const mins = fromWallet && rate > 0 ? billedMinutes(fromWallet / rate) : sessionMinutes(s);
        items.push({
          id: s.id,
          type: "chat",
          partnerId: pid,
          partnerName: asText(profile?.full_name, "User"),
          partnerAvatar: asText(profile?.photo_url, ""),
          partnerAge: profile?.age ?? null,
          partnerLanguage: profile?.language ?? null,
          partnerState: profile?.state ?? null,
          partnerCountry: profile?.country ?? null,
          status: asText(s.status, "ended"),
          startedAt: asText(s.started_at || s.created_at, ""),
          endedAt: s.ended_at || undefined,
          totalMinutes: mins,
          totalAmount,
          ratePerMinute: rate,
          endReason: s.end_reason || undefined,
          isIncoming: !isMale,
        });
      });

      // Map video sessions — detect audio vs video from call_type or rate
      videos.forEach((s) => {
        const pid = s.man_user_id === currentUserId ? s.woman_user_id : s.man_user_id;
        if (!s.id || !pid) return;
        const profile = profileMap.get(pid);
        const isAudio = (s as any).call_type === "audio";
        const rateSet = isAudio ? RATES.audio : RATES.video;
        const rate = asNum(s.rate_per_minute) || (isMale ? rateSet.man : rateSet.woman);
        const fromWallet = amountBySession.get(s.id);
        const totalAmount =
          fromWallet ??
          (isMale ? sessionMinutes(s) * rate : asNum(s.total_earned) || sessionMinutes(s) * rate);
        const mins = fromWallet && rate > 0 ? billedMinutes(fromWallet / rate) : sessionMinutes(s);
        items.push({
          id: s.id,
          type: isAudio ? "audio" : "video",
          partnerId: pid,
          partnerName: asText(profile?.full_name, "User"),
          partnerAvatar: asText(profile?.photo_url, ""),
          partnerAge: profile?.age ?? null,
          partnerLanguage: profile?.language ?? null,
          partnerState: profile?.state ?? null,
          partnerCountry: profile?.country ?? null,
          status: asText(s.status, "ended"),
          startedAt: asText(s.started_at || s.created_at, ""),
          endedAt: s.ended_at || undefined,
          totalMinutes: mins,
          totalAmount,
          ratePerMinute: rate,
          endReason: s.end_reason || undefined,
          isIncoming: !isMale,
        });
      });

      // Map group call transactions — aggregate by session_id (one row per call)
      const groupBySession = new Map<
        string,
        {
          id: string;
          totalSeconds: number;
          totalAmount: number;
          rate: number;
          startedAt: string;
          endedAt: string;
          partnerName: string;
          partnerId: string;
          partnerAvatar: string;
        }
      >();
      groupRows.forEach((tx: any) => {
        if (!tx?.id) return;
        const key = tx.session_id ? String(tx.session_id) : String(tx.id);
        const secs = asNum(tx.duration_seconds) || 60;
        const amt = asNum(tx.amount);
        const rate = asNum(tx.rate_per_minute) || (isMale ? RATES.group.man : RATES.group.woman);
        const partnerName = asText(
          tx.counterparty_name || tx.partner_name || tx.description,
          "Private Group",
        );
        const createdAt = asText(tx.created_at, "");
        const existing = groupBySession.get(key);
        if (!existing) {
          groupBySession.set(key, {
            id: key,
            totalSeconds: secs,
            totalAmount: amt,
            rate,
            startedAt: createdAt,
            endedAt: createdAt,
            partnerName,
            partnerId: asText(tx.counterparty_id || tx.partner_id, ""),
            partnerAvatar: asText(tx.partner_avatar, ""),
          });
          return;
        }
        existing.totalSeconds += secs;
        existing.totalAmount += amt;
        if (createdAt && createdAt < existing.startedAt) existing.startedAt = createdAt;
        if (createdAt && createdAt > existing.endedAt) existing.endedAt = createdAt;
      });
      groupBySession.forEach((agg) => {
        const mins = billedMinutes(agg.totalSeconds / 60);
        items.push({
          id: agg.id,
          type: "group",
          partnerId: agg.partnerId,
          partnerName: agg.partnerName,
          partnerAvatar: agg.partnerAvatar,
          status: "ended",
          startedAt: agg.startedAt,
          endedAt: agg.endedAt || undefined,
          totalMinutes: mins,
          totalAmount: agg.totalAmount > 0 ? agg.totalAmount : mins * agg.rate,
          ratePerMinute: agg.rate,
          groupName: agg.partnerName,
        });
      });

      // Map group chat participation — one row per session joined
      groupChats.forEach((row: any) => {
        if (!row?.id) return;
        const sess = asRecord(row.group_chat_sessions);
        const room = asRecord(sess?.group_chat_rooms);
        const roomName = asText(room?.name, "Group Chat");
        const isHostRow = asText(sess?.host_id, "") === currentUserId;
        const secs = asNum(row.total_seconds);
        const rate = isMale ? RATES.groupchat.man : RATES.groupchat.woman;
        // Female host earnings live on the session (wallet credit), not participant.total_billed
        const hostEarn = asNum(sess?.total_host_earning);
        const participantBilled = asNum(row.total_billed);
        let mins = billedMinutes(secs / 60);
        let billed = participantBilled || mins * rate;
        if (isHostRow && !isMale) {
          billed = hostEarn > 0 ? hostEarn : participantBilled;
          if (mins <= 0 && billed > 0 && rate > 0) {
            mins = billedMinutes(billed / rate);
          }
        }
        if (isHostRow && !isMale && billed <= 0 && mins <= 0) {
          items.push({
            id: String(row.id),
            type: "groupchat",
            partnerId: "",
            partnerName: roomName,
            partnerAvatar: "",
            status: row.left_at ? "ended" : sess?.ended_at ? "ended" : "active",
            startedAt: asText(row.joined_at || sess?.started_at, ""),
            endedAt: row.left_at || sess?.ended_at || undefined,
            totalMinutes: 0,
            totalAmount: 0,
            ratePerMinute: rate,
            groupName: roomName,
          });
          return;
        }
        items.push({
          id: String(row.id),
          type: "groupchat",
          partnerId: "",
          partnerName: roomName,
          partnerAvatar: "",
          status: row.left_at ? "ended" : sess?.ended_at ? "ended" : "active",
          startedAt: asText(row.joined_at || sess?.started_at, ""),
          endedAt: row.left_at || sess?.ended_at || undefined,
          totalMinutes: mins,
          totalAmount: billed,
          ratePerMinute: rate,
          groupName: roomName,
        });
      });

      // Sort by most recent
      items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setHistory(items);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isMale]);

  useEffect(() => {
    if (currentUserId) fetchHistory();
  }, [currentUserId, fetchHistory]);

  const filtered = filter === "all" ? history : history.filter((h) => h.type === filter);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "chat":
        return <MessageCircle className="w-4 h-4" />;
      case "audio":
        return <Phone className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "group":
        return <Users className="w-4 h-4" />;
      case "groupchat":
        return <Radio className="w-4 h-4" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "chat":
        return "bg-primary/10 text-primary";
      case "audio":
        return "bg-emerald-500/10 text-emerald-600";
      case "video":
        return "bg-accent/20 text-accent-foreground";
      case "group":
        return "bg-secondary/30 text-secondary-foreground";
      case "groupchat":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "active") return "text-primary";
    if (status === "ended" || status === "completed") return "text-muted-foreground";
    return "text-foreground";
  };

  const openChat = async (partnerId: string) => {
    const manUserId = userGender === "male" ? currentUserId : partnerId;
    const womanUserId = userGender === "female" ? currentUserId : partnerId;
    try {
      await supabase.functions.invoke("chat-manager", {
        body: {
          action: "start_chat",
          man_user_id: manUserId,
          woman_user_id: womanUserId,
        },
      });
    } catch (error) {
      console.warn("[History] Failed to pre-start chat session:", error);
    } finally {
      navigate(`/chat/${partnerId}`);
    }
  };

  const filterButtons: { id: HistoryType; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <Clock className="w-3.5 h-3.5" /> },
    { id: "chat", label: "Chats", icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: "audio", label: "Audio", icon: <Phone className="w-3.5 h-3.5" /> },
    { id: "video", label: "Video", icon: <Video className="w-3.5 h-3.5" /> },
    { id: "group", label: "Group Call", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "groupchat", label: "Group Chat", icon: <Radio className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-2">
          {filterButtons.map((fb) => (
            <button
              key={fb.id}
              onClick={() => setFilter(fb.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === fb.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/10",
              )}
            >
              {fb.icon}
              {fb.label}
            </button>
          ))}
          <button
            onClick={fetchHistory}
            className="ml-auto p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No history yet</p>
          <p className="text-xs mt-1">Your chat and call history will appear here</p>
        </div>
      )}

      {/* History list */}
      {!loading && filtered.length > 0 && (
        <div className="divide-y divide-border/30">
          {filtered.map((item) => {
            const subtitleParts: string[] = [];
            const amount = asNum(item.totalAmount);
            const rate = asNum(item.ratePerMinute);
            const mins =
              item.totalMinutes > 0
                ? item.totalMinutes
                : rate > 0 && amount > 0
                  ? billedMinutes(amount / rate)
                  : 0;
            if (item.status === "active") subtitleParts.push("Ongoing");
            else subtitleParts.push(item.endReason || "Ended");
            subtitleParts.push(`${mins} min`);
            if (rate > 0) subtitleParts.push(`₹${rate}/min`);
            subtitleParts.push(`₹${amount.toFixed(2)}`);
            const subtitle = subtitleParts.join(" · ");

            const rightMeta = (
              <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground">
                <span className={cn("p-1 rounded-full", getTypeBadgeColor(item.type))}>
                  {getTypeIcon(item.type)}
                </span>
                <span className="font-medium">{mins} min</span>
                <span
                  className={cn(
                    "font-semibold",
                    amount > 0
                      ? isMale
                        ? "text-destructive"
                        : "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {isMale ? "-" : "+"}₹{amount.toFixed(2)}
                </span>
                <span>{relativeTime(item.startedAt)}</span>
                {item.status === "active" && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30"
                  >
                    LIVE
                  </Badge>
                )}
              </div>
            );

            // Group calls / group chat: no individual partner — keep simple row
            if (item.type === "group" || item.type === "groupchat") {
              const dashboardBase = userGender === "female" ? "/women-dashboard" : "/dashboard";
              const navTarget =
                item.type === "groupchat" ? `${dashboardBase}?tab=groupchat` : "/private-groups";
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigate(navTarget)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-secondary/30 text-secondary-foreground text-sm font-semibold">
                        <Users className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 p-1 rounded-full border-2 border-background",
                        getTypeBadgeColor(item.type),
                      )}
                    >
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.groupName}</p>
                    <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex-shrink-0 text-right">
                    <p className="font-medium">{mins} min</p>
                    <p
                      className={cn(
                        "font-semibold",
                        amount > 0
                          ? isMale
                            ? "text-destructive"
                            : "text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {isMale ? "-" : "+"}₹{amount.toFixed(2)}
                    </p>
                    <p>{relativeTime(item.startedAt)}</p>
                  </div>
                </button>
              );
            }

            // 1:1 chat / video — unified Name • Age • Language • Country • Status format
            return (
              <UserContactCard
                key={`${item.type}-${item.id}`}
                userId={item.partnerId}
                name={item.partnerName}
                photoUrl={item.partnerAvatar}
                age={item.partnerAge ?? undefined}
                language={item.partnerLanguage ?? undefined}
                state={item.partnerState ?? undefined}
                country={item.partnerCountry ?? undefined}
                subtitle={subtitle}
                actions={rightMeta}
                livePresence={false}
                onClick={() => {
                  if (item.type === "chat") void openChat(item.partnerId);
                  else navigate(`/profile/${item.partnerId}`);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistoryTab;
