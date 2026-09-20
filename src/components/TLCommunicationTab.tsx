import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Send, Paperclip, Image, FileText, File, X, Download, Shield } from "lucide-react";
import { classifyError, ERROR_MESSAGES } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface TLMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  message: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  isOwn: boolean;
  isAdmin: boolean;
}

interface TLMember {
  userId: string;
  fullName: string;
  photoUrl: string | null;
  isOnline: boolean;
  isAdmin: boolean;
}

interface TLCommunicationTabProps {
  currentUserId: string;
  userName: string;
  userPhoto?: string | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function TLCommunicationTab({
  currentUserId,
  userName,
  userPhoto,
}: TLCommunicationTabProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TLMessage[]>([]);
  const [members, setMembers] = useState<TLMember[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileCacheRef = useRef<
    Map<string, { name: string; photo: string | null; isAdmin: boolean }>
  >(new Map());

  useEffect(() => {
    if (!currentUserId) return;
    void loadAll();
    const cleanup = subscribe();
    return cleanup;
  }, [currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadMessages(), loadMembers()]);
    } finally {
      setIsLoading(false);
    }
  };

  const hydrateProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profileCacheRef.current.has(id));
    if (missing.length) {
      const [{ fetchPublicProfiles }, adminRes] = await Promise.all([
        import("@/lib/profile-queries"),
        supabase.from("user_roles").select("user_id").eq("role", "admin").in("user_id", missing),
      ]);
      const profiles = await fetchPublicProfiles(missing);
      const adminSet = new Set((adminRes.data ?? []).map((r: { user_id: string }) => r.user_id));
      for (const p of profiles as any[]) {
        profileCacheRef.current.set(p.user_id, {
          name: p.full_name || "Member",
          photo: p.photo_url || null,
          isAdmin: adminSet.has(p.user_id),
        });
      }
      for (const id of missing) {
        if (!profileCacheRef.current.has(id)) {
          profileCacheRef.current.set(id, {
            name: adminSet.has(id) ? "Admin" : "Member",
            photo: null,
            isAdmin: adminSet.has(id),
          });
        }
      }
    }
  };

  const mapRow = (m: any): TLMessage => {
    const cached = profileCacheRef.current.get(m.sender_id);
    return {
      id: m.id,
      senderId: m.sender_id,
      senderName: cached?.isAdmin ? "Admin" : cached?.name || "Member",
      senderPhoto: cached?.photo || null,
      message: m.message,
      fileUrl: m.file_url,
      fileType: m.file_type,
      fileName: m.file_name,
      fileSize: m.file_size,
      createdAt: m.created_at,
      isOwn: m.sender_id === currentUserId,
      isAdmin: !!cached?.isAdmin,
    };
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("tl_communication_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) {
      toast({
        title: "Messages unavailable",
        description: ERROR_MESSAGES.chat.loadFailed,
        variant: "destructive",
      });
      return;
    }
    const rows = data ?? [];
    const senderIds = Array.from(
      new Set<string>(rows.map((m: { sender_id: string }) => m.sender_id).filter(Boolean)),
    );
    await hydrateProfiles(senderIds);
    setMessages(rows.map(mapRow));
  };

  const loadMembers = async () => {
    const [{ data: tlRows }, { data: adminRows }] = await Promise.all([
      supabase.from("user_service_roles").select("user_id").eq("role", "tl_role"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const ids = [
      ...new Set([
        ...(tlRows ?? []).map((r) => r.user_id),
        ...(adminRows ?? []).map((r) => r.user_id),
      ]),
    ];
    if (!ids.length) {
      setMembers([]);
      return;
    }
    await hydrateProfiles(ids);
    const { data: statusRows } = await supabase
      .from("user_status")
      .select("user_id, is_online")
      .in("user_id", ids);
    const online = new Set((statusRows ?? []).filter((s) => s.is_online).map((s) => s.user_id));
    setMembers(
      ids.map((id) => {
        const cached = profileCacheRef.current.get(id);
        return {
          userId: id,
          fullName: cached?.isAdmin ? "Admin" : cached?.name || "Member",
          photoUrl: cached?.photo || null,
          isOnline: online.has(id),
          isAdmin: !!cached?.isAdmin,
        };
      }),
    );
  };

  const subscribe = () => {
    const ch = supabase
      .channel("tl-communication")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tl_communication_messages" },
        async (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          await hydrateProfiles([row.sender_id]);
          const mapped = mapRow(row);
          setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  };

  const send = async () => {
    const text = newMessage.trim();
    if ((!text && !selectedFile) || isSending) return;
    setIsSending(true);
    try {
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      if (selectedFile) {
        if (selectedFile.size > MAX_FILE_SIZE) {
          toast({ title: "File too large", description: "Max 50MB", variant: "destructive" });
          return;
        }
        const ext = selectedFile.name.split(".").pop() || "bin";
        const path = `tl/${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("community-files")
          .upload(path, selectedFile, {
            contentType: selectedFile.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        fileUrl = supabase.storage.from("community-files").getPublicUrl(path).data.publicUrl;
        fileType = selectedFile.type;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
      }
      const { data: inserted, error } = await supabase
        .from("tl_communication_messages")
        .insert({
          sender_id: currentUserId,
          message: text || null,
          file_url: fileUrl,
          file_type: fileType,
          file_name: fileName,
          file_size: fileSize,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (inserted) {
        profileCacheRef.current.set(currentUserId, {
          name: userName || "You",
          photo: userPhoto || null,
          isAdmin: profileCacheRef.current.get(currentUserId)?.isAdmin ?? false,
        });
        const local = mapRow(inserted);
        local.senderName = "You";
        local.isOwn = true;
        setMessages((prev) => (prev.some((m) => m.id === local.id) ? prev : [...prev, local]));
      }
      setNewMessage("");
      setSelectedFile(null);
    } catch (err) {
      toast({
        title: "Send failed",
        description: classifyError(err).message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-5 h-5" />;
    if (fileType.startsWith("image/")) return <Image className="w-5 h-5" />;
    if (fileType.includes("pdf") || fileType.includes("document"))
      return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const onlineCount = members.filter((m) => m.isOnline).length;

  if (isLoading) {
    return (
      <Card className="h-full min-h-0 flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">TL Communication</CardTitle>
              <p className="text-xs text-muted-foreground">
                Admin + Team Leads · free · {members.length} members · {onlineCount} online
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMembers((v) => !v)}
            className="gap-2 shrink-0"
          >
            <Users className="w-4 h-4" />
            {showMembers ? "Hide" : "Members"}
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className={cn("flex-1 flex flex-col min-h-0", showMembers && "md:w-2/3")}>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">This group stays saved — it is not wiped after 7 days.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.isOwn && "flex-row-reverse")}>
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={msg.senderPhoto || undefined} />
                      <AvatarFallback className="text-xs">
                        {msg.senderName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("max-w-[70%]", msg.isOwn && "text-right")}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {msg.isOwn ? "You" : msg.senderName}
                        </span>
                        {msg.isAdmin && !msg.isOwn && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary">
                            Admin
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          msg.isOwn ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {msg.message && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        )}
                        {msg.fileUrl && (
                          <div className="mt-2">
                            {msg.fileType?.startsWith("image/") ? (
                              <img
                                src={msg.fileUrl}
                                alt={msg.fileName || "image"}
                                className="max-h-48 rounded"
                              />
                            ) : (
                              <a
                                href={msg.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs underline"
                              >
                                {fileIcon(msg.fileType)}
                                <span>
                                  {msg.fileName || "File"} {formatFileSize(msg.fileSize)}
                                </span>
                                <Download className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t space-y-2">
            {selectedFile && (
              <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                <Paperclip className="w-3 h-3" />
                <span className="truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message the TL group…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                onClick={() => void send()}
                disabled={isSending || (!newMessage.trim() && !selectedFile)}
                size="icon"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {showMembers && (
          <div className="hidden md:flex w-1/3 flex-col border-l">
            <div className="px-3 py-2 text-xs font-semibold border-b">Members</div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="relative">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={m.photoUrl || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {m.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                          m.isOnline ? "bg-green-500" : "bg-muted-foreground",
                        )}
                      />
                    </div>
                    <span className="text-xs truncate flex-1">{m.fullName}</span>
                    {m.isAdmin && <span className="text-[9px] text-primary">Admin</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}

export default TLCommunicationTab;
