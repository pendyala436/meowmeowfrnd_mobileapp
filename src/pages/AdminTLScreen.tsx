import AdminNav from "@/components/AdminNav";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { TLCommunicationTab } from "@/components/TLCommunicationTab";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminTLScreen() {
  const { isLoading, adminEmail } = useAdminAccess();
  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: { id: string } | null } }) =>
        setAdminId(data.user?.id ?? null),
      );
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminNav>
      <div className="min-w-0 w-full max-w-full space-y-3 overflow-x-hidden">
        <div className="min-w-0 max-w-full">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary shrink-0" /> TL
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            Shared channel with Team Lead women · free · {adminEmail}
          </p>
        </div>
        {/* Fit between admin header + bottom tabs; chat scrolls inside. */}
        <div
          className="min-w-0 w-full max-w-full border border-border rounded-xl bg-card overflow-hidden
            h-[calc(100dvh-10.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]
            sm:h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]
            md:h-[75vh] min-h-[20rem]"
        >
          {adminId ? (
            <TLCommunicationTab currentUserId={adminId} userName="Admin" />
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>
    </AdminNav>
  );
}
