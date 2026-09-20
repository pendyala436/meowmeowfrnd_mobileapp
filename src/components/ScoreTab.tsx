import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayEarning {
  date: string;
  amount: number;
}

interface ScoreRow {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  total: number;
  days: DayEarning[];
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export function ScoreTab({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_women_scoreboard");
    if (rpcError) {
      setError(rpcError.message || "Could not load scores");
      setRows([]);
    } else {
      const list = (Array.isArray(data) ? data : []) as ScoreRow[];
      setRows(
        list.map((r) => ({
          ...r,
          total: Number(r.total) || 0,
          days: Array.isArray(r.days)
            ? r.days.map((d) => ({ date: d.date, amount: Number(d.amount) || 0 }))
            : [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="min-h-0 h-full overflow-y-auto overscroll-contain">
      <div className="px-4 py-3 border-b border-border/30 bg-gradient-to-br from-amber-500/10 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Score this month
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Earnings since the last payout statement. Resets to ₹0 when admin generates payout.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-7 w-7 p-0"
            aria-label="Refresh scores"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-center text-sm text-destructive py-12">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No scores yet this period.
        </p>
      ) : (
        <div>
          {rows.map((row, idx) => {
            const isMe = row.user_id === currentUserId;
            const open = openId === row.user_id;
            return (
              <div
                key={row.user_id}
                className={cn("border-b border-border/30", isMe && "bg-primary/5")}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setOpenId(open ? null : row.user_id)}
                >
                  <span
                    className={cn(
                      "w-6 text-center text-xs font-bold",
                      idx === 0
                        ? "text-amber-500"
                        : idx === 1
                          ? "text-slate-400"
                          : idx === 2
                            ? "text-orange-700"
                            : "text-muted-foreground",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={row.photo_url || undefined} />
                    <AvatarFallback>{row.full_name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {row.full_name}
                      {isMe ? " (You)" : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.days.length} day{row.days.length === 1 ? "" : "s"} with earnings
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary">{formatINR(row.total)}</p>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {open && (
                  <div className="px-4 pb-3 pl-16 space-y-1">
                    {row.days.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No daily earnings yet — score is ₹0 until the next paid session.
                      </p>
                    ) : (
                      row.days.map((d) => (
                        <div key={d.date} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{d.date}</span>
                          <span className="font-medium">{formatINR(d.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScoreTab;
