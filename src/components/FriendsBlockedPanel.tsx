/**
 * FriendsBlockedPanel
 *
 * Full-screen overlay panel for managing friends and blocked users.
 *
 * Tabs:
 * - Friends: Accepted friends with Chat & Unfriend actions
 * - Requests: Pending incoming requests (Accept/Reject) + Sent requests (Cancel)
 * - Browse: Search opposite-sex users to Add Friend or Block
 * - Blocked: Blocked users with Unblock action
 *
 * Men's dashboard shows women, Women's dashboard shows men.
 * All validation handled by secure DB functions (see useUserRelationships).
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  ShieldOff,
  UserMinus,
  ArrowLeft,
  Loader2,
  UserX,
  Heart,
  MessageCircle,
  UserPlus,
  ShieldBan,
  Search,
  Check,
  X,
  Clock,
  Send,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUserRelationships } from "@/hooks/useUserRelationships";

// --- Browse user type (loaded separately) ---
interface BrowseUser {
  userId: string;
  fullName: string;
  photoUrl: string | null;
  age: number | null;
  country: string | null;
  primaryLanguage: string | null;
  isOnline: boolean;
}

interface FriendsBlockedPanelProps {
  currentUserId: string;
  userGender: "male" | "female";
  onClose: () => void;
  onStartChat?: (targetUserId: string, targetName: string) => void;
}

export const FriendsBlockedPanel = ({
  currentUserId,
  userGender,
  onClose,
  onStartChat,
}: FriendsBlockedPanelProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // All relationship data and actions from the hook
  const {
    friends,
    blockedUsers,
    pendingRequests,
    sentRequests,
    isLoading,
    actionLoading,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    unfriend,
    blockUser,
    unblockUser,
    isFriend,
    isBlocked,
    hasSentRequest,
    hasPendingRequest,
    getSentRequestId,
    getReceivedRequestId,
  } = useUserRelationships(currentUserId);

  // Browse tab state
  const [browseUsers, setBrowseUsers] = useState<BrowseUser[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "unfriend" | "block" | "unblock";
    userId: string;
    userName: string;
  } | null>(null);

  // Chat starting state
  const [chatStarting, setChatStarting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "browse" | "blocked">(
    "friends",
  );

  // Pending request count for badge
  const pendingCount = pendingRequests.length;

  // --- Browse tab data loading ---
  const loadBrowseUsers = useCallback(async () => {
    setBrowseLoading(true);
    try {
      // Men see women, women see men
      const profileTable = userGender === "male" ? "female_profiles" : "male_profiles";

      const { data: profiles, error } = await supabase
        .from(profileTable)
        .select("user_id, full_name, photo_url, age, country, primary_language")
        .neq("user_id", currentUserId)
        .eq("account_status", "active")
        .limit(200);

      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setBrowseUsers([]);
        return;
      }

      const userIds = profiles.map((p) => p.user_id);

      // Get online status
      const { data: statusData } = await supabase
        .from("user_status")
        .select("user_id, is_online")
        .in("user_id", userIds);

      const statusMap = new Map(
        statusData?.map((s) => [s.user_id, s.is_online as boolean] as const) || [],
      );

      const list: BrowseUser[] = profiles.map((p) => ({
        userId: p.user_id,
        fullName: p.full_name || "Unknown",
        photoUrl: p.photo_url,
        age: p.age,
        country: p.country,
        primaryLanguage: p.primary_language,
        isOnline: statusMap.get(p.user_id) ?? false,
      }));

      // Online users first, then alphabetical
      list.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      });

      setBrowseUsers(list);
    } catch (error) {
      console.error("Error loading browse users:", error);
      toast.error("Users unavailable", {
        description: "Unable to load users. Please refresh the page.",
      });
    } finally {
      setBrowseLoading(false);
    }
  }, [currentUserId, userGender]);

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "browse" && browseUsers.length === 0) void loadBrowseUsers();
  };

  // --- Chat with friend ---
  const handleStartChat = async (friendId: string, friendName: string, friendOnline: boolean) => {
    if (!friendOnline) {
      toast({
        title: "User Offline",
        description: `${friendName} is currently offline`,
        variant: "destructive",
      });
      return;
    }

    setChatStarting(friendId);
    try {
      if (onStartChat) {
        onStartChat(friendId, friendName);
        onClose();
        return;
      }

      // Use chat-manager edge function
      const { data, error } = await supabase.functions.invoke("chat-manager", {
        body: {
          action: "start_chat",
          user_id: currentUserId,
          ...(userGender === "male" ? { woman_user_id: friendId } : { man_user_id: friendId }),
        },
      });

      if (error) throw error;

      // Mark as self-initiated to prevent incoming chat popup
      if (data?.session_id || data?.chat_id) {
        const { markChatAsSelfInitiated } = await import("@/hooks/useIncomingChats");
        markChatAsSelfInitiated(data.session_id, data.chat_id);
      }

      if (data?.success) {
        onClose();
        setTimeout(() => {
          toast({
            title: "💬 Chat Started",
            description: `Your chat with ${friendName} is now open below`,
          });
        }, 300);
      } else {
        throw new Error(data?.error || "Failed to start chat");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to start chat",
        variant: "destructive",
      });
    } finally {
      setChatStarting(null);
    }
  };

  // --- Confirm action handler ---
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, userId } = confirmAction;

    if (type === "unfriend") await unfriend(userId);
    else if (type === "block") await blockUser(userId);
    else if (type === "unblock") await unblockUser(userId);

    setConfirmAction(null);
  };

  // Filter browse users by search
  const filteredBrowse = browseUsers.filter(
    (u) =>
      !searchQuery ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.primaryLanguage?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // --- Render helpers ---

  const renderEmptyState = (icon: React.ReactNode, title: string, subtitle: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-white/80">
      <div className="mb-3 opacity-70">{icon}</div>
      <p className="text-sm text-white">{title}</p>
      <p className="mt-1 text-xs text-white/70">{subtitle}</p>
    </div>
  );

  const renderAvatar = (name: string, photo: string | null, isOnline?: boolean) => (
    <div className="relative flex-shrink-0">
      <Avatar className="h-11 w-11">
        <AvatarImage src={photo || undefined} />
        <AvatarFallback className="bg-primary/10 text-sm">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
            isOnline ? "bg-online" : "bg-muted-foreground",
          )}
        />
      )}
    </div>
  );

  // Helper to get the action button for browse users
  const renderBrowseActions = (user: BrowseUser) => {
    const blocked = isBlocked(user.userId);
    const friend = isFriend(user.userId);
    const sentReq = hasSentRequest(user.userId);
    const receivedReq = hasPendingRequest(user.userId);

    if (blocked) {
      return (
        <Badge variant="destructive" className="text-xs">
          Blocked
        </Badge>
      );
    }

    if (friend) {
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <Heart className="h-3 w-3" /> Friend
        </Badge>
      );
    }

    if (sentReq) {
      const reqId = getSentRequestId(user.userId);
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs h-8"
          disabled={actionLoading}
          onClick={() => reqId && cancelRequest(reqId)}
        >
          <Clock className="h-3.5 w-3.5" /> Pending
        </Button>
      );
    }

    if (receivedReq) {
      const reqId = getReceivedRequestId(user.userId);
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            className="gap-1 text-xs h-8"
            disabled={actionLoading}
            onClick={() => reqId && acceptRequest(reqId)}
          >
            <Check className="h-3.5 w-3.5" /> Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            disabled={actionLoading}
            onClick={() => reqId && rejectRequest(reqId)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          className="gap-1 text-xs h-8"
          disabled={actionLoading}
          onClick={() => sendFriendRequest(user.userId)}
        >
          <UserPlus className="h-3.5 w-3.5" /> Add
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 text-destructive hover:bg-destructive/10"
          disabled={actionLoading}
          onClick={() =>
            setConfirmAction({ type: "block", userId: user.userId, userName: user.fullName })
          }
        >
          <ShieldBan className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return createPortal(
    <div
      className="friends-blocked-panel fixed inset-0 flex flex-col text-white"
      style={{
        zIndex: 200,
        backgroundColor: "hsl(var(--background))",
        isolation: "isolate",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/20 px-3 py-3 sm:px-4"
        style={{ backgroundColor: "hsl(var(--primary))" }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-white hover:bg-white/15"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold text-white sm:text-lg">
          Friends & Blocked
        </h1>
      </div>

      <div className="relative z-10 shrink-0 px-3 pt-3 sm:px-4">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
          {(
            [
              { id: "friends" as const, label: `Friends (${friends.length})`, icon: Heart },
              { id: "requests" as const, label: "Requests", icon: Send, badge: pendingCount },
              { id: "browse" as const, label: "Browse", icon: Search },
              { id: "blocked" as const, label: `Blocked (${blockedUsers.length})`, icon: UserX },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] sm:flex-row sm:gap-1 sm:text-xs",
                  selected ? "bg-background text-white shadow" : "text-white/80 hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {"badge" in tab && (tab as { badge?: number }).badge! > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {(tab as { badge: number }).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4">
        <div
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-white/25"
          style={{ backgroundColor: "rgba(0,0,0,0.35)", minHeight: "50vh" }}
        >
          <div
            className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {activeTab === "friends" && (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                  </div>
                ) : friends.length === 0 ? (
                  renderEmptyState(
                    <Users className="h-12 w-12" />,
                    "No friends yet",
                    "Go to Browse tab to find and add friends",
                  )
                ) : (
                  <div className="divide-y divide-white/15">
                    {friends.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-col gap-2 p-3 transition-colors hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {renderAvatar(f.friendName, f.friendPhoto, f.isOnline)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {f.friendName}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border-white/30 px-1.5 py-0 text-[10px] text-white",
                                  f.isOnline && "border-online/40 text-online",
                                )}
                              >
                                {f.isOnline ? "Online" : "Offline"}
                              </Badge>
                              {f.primaryLanguage && (
                                <span className="text-[10px] text-white/75">
                                  {f.primaryLanguage}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/30 bg-white/10"
                            onClick={() => navigate(`/profile/${f.friendId}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            disabled={!f.isOnline || chatStarting === f.friendId}
                            onClick={() => handleStartChat(f.friendId, f.friendName, f.isOnline)}
                          >
                            {chatStarting === f.friendId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3.5 w-3.5" />
                            )}
                            Chat
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/30 bg-white/10 text-destructive hover:bg-destructive/20"
                            onClick={() =>
                              setConfirmAction({
                                type: "unfriend",
                                userId: f.friendId,
                                userName: f.friendName,
                              })
                            }
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "requests" && (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                  </div>
                ) : pendingRequests.length === 0 && sentRequests.length === 0 ? (
                  renderEmptyState(
                    <Send className="h-12 w-12" />,
                    "No pending requests",
                    "Friend requests you send or receive will appear here",
                  )
                ) : (
                  <div>
                    {pendingRequests.length > 0 && (
                      <>
                        <div className="bg-black/30 px-4 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                            Received ({pendingRequests.length})
                          </p>
                        </div>
                        <div className="divide-y divide-white/15">
                          {pendingRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex flex-col gap-2 p-3 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {renderAvatar(req.fromUserName, req.fromUserPhoto)}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {req.fromUserName}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    {req.age && (
                                      <span className="text-[10px] text-white/75">{req.age}y</span>
                                    )}
                                    {req.country && (
                                      <span className="text-[10px] text-white/75">
                                        {req.country}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-white/30 bg-white/10"
                                  onClick={() => navigate(`/profile/${req.fromUserId}`)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  disabled={actionLoading}
                                  onClick={() => acceptRequest(req.id)}
                                >
                                  <Check className="h-3.5 w-3.5" /> Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-white/30 bg-white/10 text-destructive hover:bg-destructive/20"
                                  disabled={actionLoading}
                                  onClick={() => rejectRequest(req.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {sentRequests.length > 0 && (
                      <>
                        <div className="bg-black/30 px-4 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                            Sent ({sentRequests.length})
                          </p>
                        </div>
                        <div className="divide-y divide-white/15">
                          {sentRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex flex-col gap-2 p-3 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {renderAvatar(req.toUserName, req.toUserPhoto)}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {req.toUserName}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="border-white/30 px-1.5 py-0 text-[10px] text-white"
                                  >
                                    <Clock className="mr-1 h-2.5 w-2.5" /> Pending
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-white/30 bg-white/10"
                                  onClick={() => navigate(`/profile/${req.toUserId}`)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 border-white/30 bg-white/10 text-xs"
                                  disabled={actionLoading}
                                  onClick={() => cancelRequest(req.id)}
                                >
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === "browse" && (
              <>
                <div className="sticky top-0 z-10 border-b border-white/15 bg-black/40 px-3 py-3 backdrop-blur">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                    <Input
                      placeholder="Search by name, country, or language..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 border-white/30 bg-black/20 pl-9"
                    />
                  </div>
                </div>
                {browseLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                  </div>
                ) : filteredBrowse.length === 0 ? (
                  renderEmptyState(
                    <Users className="h-12 w-12" />,
                    searchQuery ? "No users found" : "No users available",
                    searchQuery ? "Try a different search term" : "Check back later",
                  )
                ) : (
                  <div className="divide-y divide-white/15">
                    {filteredBrowse.map((user) => (
                      <div
                        key={user.userId}
                        className="flex flex-col gap-2 p-3 transition-colors hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {renderAvatar(user.fullName, user.photoUrl, user.isOnline)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {user.fullName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {user.age && (
                                <span className="text-[10px] text-white/75">{user.age}y</span>
                              )}
                              {user.country && (
                                <span className="truncate text-[10px] text-white/75">
                                  {user.country}
                                </span>
                              )}
                              {user.primaryLanguage && (
                                <Badge
                                  variant="outline"
                                  className="border-white/30 px-1.5 py-0 text-[10px] text-white"
                                >
                                  {user.primaryLanguage}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/30 bg-white/10"
                            onClick={() => navigate(`/profile/${user.userId}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {renderBrowseActions(user)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "blocked" && (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  renderEmptyState(
                    <ShieldOff className="h-12 w-12" />,
                    "No blocked users",
                    "Users you block will appear here",
                  )
                ) : (
                  <div className="divide-y divide-white/15">
                    {blockedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col gap-2 p-3 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {renderAvatar(user.blockedName, user.blockedPhoto)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {user.blockedName}
                            </p>
                            <p className="text-[10px] text-white/75">
                              Blocked {new Date(user.blockedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 self-end border-white/30 bg-white/10 text-xs sm:self-auto"
                          disabled={actionLoading}
                          onClick={() =>
                            setConfirmAction({
                              type: "unblock",
                              userId: user.blockedUserId,
                              userName: user.blockedName,
                            })
                          }
                        >
                          <ShieldOff className="h-3.5 w-3.5" /> Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="z-[220]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "unfriend" &&
                `Remove ${confirmAction.userName} from friends?`}
              {confirmAction?.type === "block" && `Block ${confirmAction?.userName}?`}
              {confirmAction?.type === "unblock" && `Unblock ${confirmAction?.userName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "unfriend" &&
                "You can add them back later by sending a new friend request."}
              {confirmAction?.type === "block" &&
                "They won't be able to message, call, or send you friend requests. Any existing friendship will be removed."}
              {confirmAction?.type === "unblock" &&
                "They will be able to send you friend requests and messages again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionLoading}
              className={cn(
                confirmAction?.type !== "unblock" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {confirmAction?.type === "unfriend" && "Unfriend"}
              {confirmAction?.type === "block" && "Block"}
              {confirmAction?.type === "unblock" && "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>,
    document.body,
  );
};

export default FriendsBlockedPanel;
