import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPinnedChatRowProps {
  onClick: () => void;
  unread?: number;
}

export function AdminPinnedChatRow({ onClick, unread = 0 }: AdminPinnedChatRowProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted/70 transition-colors cursor-pointer border-b border-border/30 bg-primary/5"
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12 border-2 border-primary/30">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Shield className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background bg-[#4CAF50]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm", unread > 0 ? "font-bold" : "font-semibold")}>Admin</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
            FREE
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          Chat with Admin — no wallet charges
        </p>
      </div>
      {unread > 0 && (
        <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </div>
  );
}
