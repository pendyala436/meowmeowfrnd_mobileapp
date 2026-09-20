import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AdminSideChat } from "@/components/AdminSideChat";
import { TLCommunicationTab } from "@/components/TLCommunicationTab";
import { Users, Crown, Search, Loader2, Wallet, CircleOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface DirectoryUser {
  user_id: string;
  full_name: string;
  gender: string | null;
  photo_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  has_recharged: boolean;
}

interface DirMessage {
  target_user_id: string;
  sender_role: string;
  is_read: boolean;
  message: string;
  created_at: string;
}
interface DirProfile {
  user_id: string;
  full_name: string | null;
  gender: string | null;
}
interface Thread {
  user_id: string;
  full_name: string;
  gender: string | null;
  last_message: string;
  last_time: string;
  unread: number;
}

function sortPresence<T extends { is_online: boolean; last_seen: string | null }>(arr: T[]) {
  return [...arr].sort((a, b) => {
    if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
    const at = a.last_seen ? new Date(a.last_seen).getTime() : 0;
    const bt = b.last_seen ? new Date(b.last_seen).getTime() : 0;
    return bt - at;
  });
}

function UserRow({
  u,
  unread,
  onClick,
}: {
  u: {
    full_name: string;
    photo_url?: string | null;
    is_online?: boolean;
    last_seen?: string | null;
  };
  unread?: number;
  onClick: () => void;
}) {
  const seen = u.last_seen
    ? u.is_online
      ? "Online"
      : `Last ${formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}`
    : u.is_online
      ? "Online"
      : "Offline";
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
    >
      <div className="relative w-9 h-9 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center shrink-0">
        {u.photo_url ? (
          <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Users className="w-4 h-4 text-primary" />
        )}
        <span
          className={`absolute -bottom-0 -right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${u.is_online ? "bg-[#4CAF50]" : "bg-[#9E9E9E]"}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{u.full_name}</p>
        <p className="text-[10px] text-muted-foreground">{seen}</p>
      </div>
      {typeof unread === "number" && unread > 0 && (
        <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">{unread}</Badge>
      )}
    </button>
  );
}

async function loadDirectoryFallback(): Promise<DirectoryUser[]> {
  const [{ data: profs }, { data: statusRows }, { data: adminRows }, { data: wallets }] =
    await Promise.all([
      supabase.from("profiles").select("user_id, full_name, gender, photo_url"),
      supabase.from("user_status").select("user_id, is_online, last_seen"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase.from("wallets").select("user_id, balance"),
    ]);

  const adminSet = new Set((adminRows ?? []).map((r) => r.user_id));
  const statusBy = new Map<string, { is_online: boolean; last_seen: string | null }>(
    (statusRows ?? []).map((s) => [
      s.user_id,
      { is_online: !!s.is_online, last_seen: s.last_seen ?? null },
    ]),
  );
  const balBy = new Map<string, number>(
    (wallets ?? []).map((w) => [w.user_id, Number(w.balance) || 0]),
  );

  const recharged = new Set<string>();
  const { data: rechargeRows } = await supabase
    .from("wallet_transactions")
    .select("user_id")
    .eq("type", "credit")
    .eq("transaction_type", "recharge");
  for (const r of rechargeRows ?? []) {
    if (r.user_id) recharged.add(r.user_id);
  }

  return (profs ?? [])
    .filter((p) => p.user_id && !adminSet.has(p.user_id))
    .map((p) => {
      const st = statusBy.get(p.user_id);
      const gender = (p.gender || "").toLowerCase() || null;
      return {
        user_id: p.user_id,
        full_name: p.full_name || "User",
        gender,
        photo_url: p.photo_url || null,
        is_online: !!st?.is_online,
        last_seen: st?.last_seen ?? null,
        has_recharged: recharged.has(p.user_id) || (balBy.get(p.user_id) || 0) > 0,
      };
    });
}

interface AdminDirectoryChatProps {
  showTl?: boolean;
  defaultTab?: "online" | "chats" | "tl";
}

export function AdminDirectoryChat({
  showTl = true,
  defaultTab = "online",
}: AdminDirectoryChatProps) {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [tab, setTab] = useState<"online" | "chats" | "tl">(defaultTab);
  const [search, setSearch] = useState("");
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? null));
  }, []);

  const loadDirectory = async () => {
    const { data, error } = await supabase.rpc("get_admin_user_directory");
    if (!error && data) {
      const list = (Array.isArray(data) ? data : []) as unknown as DirectoryUser[];
      if (list.length > 0) {
        setDirectory(
          list.map((u) => ({
            ...u,
            gender: (u.gender || "").toLowerCase() || null,
            is_online: !!u.is_online,
            has_recharged: !!u.has_recharged,
          })),
        );
        return;
      }
    }
    try {
      setDirectory(await loadDirectoryFallback());
    } catch (e) {
      console.warn("[AdminDirectory] fallback failed", e);
      setDirectory([]);
    }
  };

  const loadThreads = async () => {
    const { data } = await supabase
      .from("admin_user_messages")
      .select("target_user_id, sender_role, message, created_at, is_read")
      .eq("target_group", "direct")
      .order("created_at", { ascending: false })
      .limit(500);
    const grouped = new Map<string, Thread>();
    for (const m of (data ?? []) as DirMessage[]) {
      const uid = m.target_user_id as string;
      if (!uid) continue;
      const cur = grouped.get(uid);
      const unreadInc = m.sender_role === "user" && !m.is_read ? 1 : 0;
      if (!cur) {
        grouped.set(uid, {
          user_id: uid,
          full_name: "User",
          gender: null,
          last_message: m.message,
          last_time: m.created_at,
          unread: unreadInc,
        });
      } else {
        cur.unread += unreadInc;
      }
    }
    const ids = Array.from(grouped.keys());
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, gender")
        .in("user_id", ids);
      for (const p of (profs ?? []) as DirProfile[]) {
        const t = grouped.get(p.user_id);
        if (t) {
          t.full_name = p.full_name ?? "User";
          t.gender = p.gender ?? null;
        }
      }
    }
    setThreads(Array.from(grouped.values()).sort((a, b) => b.last_time.localeCompare(a.last_time)));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDirectory(), loadThreads()]).finally(() => setLoading(false));
    const iv = setInterval(loadDirectory, 20_000);
    const ch = supabase
      .channel("admin-directory-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_user_messages" }, () =>
        loadThreads(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status" }, () =>
        loadDirectory(),
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, []);

  const q = search.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const genderOf = (g: string | null) => (g || "").toLowerCase();

  const menRecharged = useMemo(
    () =>
      sortPresence(
        directory.filter(
          (o) => genderOf(o.gender) === "male" && o.has_recharged && matches(o.full_name),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mount/effect deps; adding would remount chat/billing/call loops
    [directory, q],
  );
  const menNoRecharge = useMemo(
    () =>
      sortPresence(
        directory.filter(
          (o) => genderOf(o.gender) === "male" && !o.has_recharged && matches(o.full_name),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mount/effect deps; adding would remount chat/billing/call loops
    [directory, q],
  );
  const women = useMemo(
    () =>
      sortPresence(
        directory.filter((o) => genderOf(o.gender) === "female" && matches(o.full_name)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable mount/effect deps; adding would remount chat/billing/call loops
    [directory, q],
  );

  const open = (id: string, name: string) => setActive({ id, name });

  const threeLists = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Men · recharged ({menRecharged.length})
        </div>
        <ScrollArea className="h-[55vh]">
          <div className="p-1.5 space-y-1">
            {menRecharged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No matching men</p>
            ) : (
              menRecharged.map((u) => (
                <UserRow key={u.user_id} u={u} onClick={() => open(u.user_id, u.full_name)} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold flex items-center gap-1.5">
          <CircleOff className="w-3.5 h-3.5" /> Men · no recharge ({menNoRecharge.length})
        </div>
        <ScrollArea className="h-[55vh]">
          <div className="p-1.5 space-y-1">
            {menNoRecharge.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No matching men</p>
            ) : (
              menNoRecharge.map((u) => (
                <UserRow key={u.user_id} u={u} onClick={() => open(u.user_id, u.full_name)} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" /> Women ({women.length})
        </div>
        <ScrollArea className="h-[55vh]">
          <div className="p-1.5 space-y-1">
            {women.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No matching women</p>
            ) : (
              women.map((u) => (
                <UserRow key={u.user_id} u={u} onClick={() => open(u.user_id, u.full_name)} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search any user to chat…"
          className="pl-9"
        />
      </div>

      {loading && directory.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "online" | "chats" | "tl")}>
          <TabsList className={`grid w-full ${showTl ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="online" className="text-xs">
              Online{" "}
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {directory.filter((d) => d.is_online).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="chats" className="text-xs">
              Chats{" "}
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {threads.length}
              </Badge>
            </TabsTrigger>
            {showTl && (
              <TabsTrigger value="tl" className="text-xs">
                TL Comm
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="online" className="mt-3">
            {threeLists}
          </TabsContent>

          <TabsContent value="chats" className="mt-3 space-y-3">
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold">
                Recent admin chats — tap anyone below to start a free chat
              </div>
              <ScrollArea className="h-[28vh]">
                <div className="p-1.5 space-y-1">
                  {threads.filter((t) => matches(t.full_name)).length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">
                      No threads yet. Use the lists below to chat with any user.
                    </p>
                  ) : (
                    threads
                      .filter((t) => matches(t.full_name))
                      .map((t) => (
                        <button
                          key={t.user_id}
                          onClick={() => open(t.user_id, t.full_name)}
                          className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{t.full_name}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {new Date(t.last_time).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {t.last_message}
                            </p>
                          </div>
                          {t.unread > 0 && (
                            <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">
                              {t.unread}
                            </Badge>
                          )}
                        </button>
                      ))
                  )}
                </div>
              </ScrollArea>
            </div>
            {threeLists}
          </TabsContent>

          {showTl && (
            <TabsContent value="tl" className="mt-3">
              <div className="border border-border rounded-xl bg-card overflow-hidden h-[65vh]">
                {adminId ? (
                  <TLCommunicationTab currentUserId={adminId} userName="Admin" />
                ) : (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">Chat with {active?.name ?? "user"}</DialogTitle>
          {active && adminId && (
            <AdminSideChat
              adminId={adminId}
              targetUserId={active.id}
              targetUserName={active.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDirectoryChat;
