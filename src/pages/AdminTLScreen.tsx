import AdminNav from '@/components/AdminNav';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { TLCommunicationTab } from '@/components/TLCommunicationTab';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminTLScreen() {
  const { isLoading, adminEmail } = useAdminAccess();
  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? null));
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
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> TL
          </h1>
          <p className="text-xs text-muted-foreground">
            Shared channel with Team Lead women · free · {adminEmail}
          </p>
        </div>
        <div className="border border-border rounded-xl bg-card overflow-hidden h-[75vh]">
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
