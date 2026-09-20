/**
 * AdminLiveMessenger — /admin/messenger
 * Online + Chats: all men/women (recharge split, online first) — free admin chat
 */
import AdminNav from '@/components/AdminNav';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { AdminDirectoryChat } from '@/components/AdminDirectoryChat';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function AdminLiveMessenger() {
  const { isLoading, adminEmail } = useAdminAccess();

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
            <MessageSquare className="w-5 h-5 text-primary" /> Online & Chat
          </h1>
          <p className="text-xs text-muted-foreground">
            Chat with any man or woman · free · {adminEmail}
          </p>
        </div>
        <AdminDirectoryChat showTl={false} />
      </div>
    </AdminNav>
  );
}
