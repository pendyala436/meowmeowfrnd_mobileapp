/**
 * AdminUserAccessPanel — Enable/disable users (men & women) with action history.
 * Used inside Admin Enable/Disable under the "Users" tab.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, Search, UserCheck, UserX } from "lucide-react";

type GenderFilter = "all" | "male" | "female";

interface AccessUser {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  gender: string | null;
  account_status: string;
  photo_url: string | null;
  user_code: string | null;
}

interface AccessHistoryRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  gender: string | null;
  action: string;
  previous_status: string | null;
  new_status: string;
  admin_email: string | null;
  details: string | null;
  created_at: string;
}

const isEnabledStatus = (status: string | null | undefined) => {
  const s = (status || "active").toLowerCase();
  return s === "active";
};

const normalizeGender = (g: string | null | undefined) => {
  const v = (g || "").toLowerCase();
  if (v === "female" || v === "woman" || v === "women") return "female";
  if (v === "male" || v === "man" || v === "men") return "male";
  return v || "unknown";
};

export default function AdminUserAccessPanel() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [history, setHistory] = useState<AccessHistoryRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [historyGender, setHistoryGender] = useState<GenderFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, email, gender, account_status, photo_url, user_code")
        .order("created_at", { ascending: false })
        .limit(200);

      if (genderFilter === "female") {
        query = query.in("gender", ["female", "Female", "woman", "Woman"]);
      } else if (genderFilter === "male") {
        query = query.in("gender", ["male", "Male", "man", "Man"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers((data as AccessUser[]) || []);
    } catch (err) {
      console.error("[AdminUserAccess] loadUsers:", err);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, [genderFilter]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_access_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      let rows = (data as AccessHistoryRow[]) || [];
      if (historyGender !== "all") {
        rows = rows.filter((r) => normalizeGender(r.gender) === historyGender);
      }
      setHistory(rows);
    } catch (err) {
      console.error("[AdminUserAccess] loadHistory:", err);
      toast.error("Failed to load enable/disable history");
    } finally {
      setLoadingHistory(false);
    }
  }, [historyGender]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.user_code || "").toLowerCase().includes(q) ||
      (u.user_id || "").toLowerCase().includes(q)
    );
  });

  const handleToggle = async (user: AccessUser, enable: boolean) => {
    setTogglingId(user.id);
    const previous = user.account_status || "active";
    const nextStatus = enable ? "active" : "disabled";
    const action = enable ? "enabled" : "disabled";

    try {
      const { data: { user: admin } } = await supabase.auth.getUser();
      if (!admin) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;

      // Keep gender-specific tables in sync when present
      const g = normalizeGender(user.gender);
      if (g === "female") {
        await supabase
          .from("female_profiles")
          .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
          .eq("user_id", user.user_id);
      } else if (g === "male") {
        await supabase
          .from("male_profiles")
          .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
          .eq("user_id", user.user_id);
      }

      await (supabase as any).from("user_access_history").insert({
        user_id: user.user_id,
        profile_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        gender: g,
        action,
        previous_status: previous,
        new_status: nextStatus,
        admin_id: admin.id,
        admin_email: admin.email || null,
        details: `Account ${action} by admin`,
      });

      toast.success(`User ${action}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, account_status: nextStatus } : u))
      );
      void loadHistory();
    } catch (err: any) {
      console.error("[AdminUserAccess] toggle:", err);
      toast.error(err?.message || "Failed to update user access");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="manage">Manage Users</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["all", "male", "female"] as GenderFilter[]).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={genderFilter === g ? "default" : "outline"}
                  onClick={() => setGenderFilter(g)}
                >
                  {g === "all" ? "All" : g === "male" ? "Men" : "Women"}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => void loadUsers()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loadingUsers ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Enable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const enabled = isEnabledStatus(user.account_status);
                        const g = normalizeGender(user.gender);
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {user.full_name || "Unnamed"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {user.email || user.user_code || user.user_id.slice(0, 8)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {g === "female" ? "Woman" : g === "male" ? "Man" : g}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {enabled ? (
                                <Badge className="bg-green-600/20 text-green-700 border-0 gap-1">
                                  <UserCheck className="w-3 h-3" /> Enabled
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/15 text-destructive border-0 gap-1">
                                  <UserX className="w-3 h-3" /> Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={enabled}
                                disabled={togglingId === user.id}
                                onCheckedChange={(next) => void handleToggle(user, next)}
                                aria-label={`${enabled ? "Disable" : "Enable"} ${user.full_name || "user"}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(["all", "male", "female"] as GenderFilter[]).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={historyGender === g ? "default" : "outline"}
                  onClick={() => setHistoryGender(g)}
                >
                  {g === "all" ? "All" : g === "male" ? "Men" : "Women"}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => void loadHistory()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>

          {loadingHistory ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No enable/disable history yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((row) => {
                        const g = normalizeGender(row.gender);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {format(new Date(row.created_at), "dd MMM yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{row.user_name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.user_email || row.user_id.slice(0, 8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {g === "female" ? "Woman" : g === "male" ? "Man" : g}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.action === "enabled" ? (
                                <Badge className="bg-green-600/20 text-green-700 border-0">Enabled</Badge>
                              ) : (
                                <Badge className="bg-destructive/15 text-destructive border-0">Disabled</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.admin_email || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
