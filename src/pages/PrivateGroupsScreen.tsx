import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { ROUTES } from "@/constants";

/**
 * /private-groups is a stable URL alias (bookmarks, call history, PWA shortcuts).
 * Private groups UI lives on the dashboard Group Call tab — this route redirects there.
 */
const PrivateGroupsScreen = () => {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      navigate(ROUTES.HOME, { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [{ data: profile }, { data: adminRole }] = await Promise.all([
          supabase.from("profiles").select("gender").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (adminRole) {
          navigate("/admin", { replace: true });
          return;
        }

        const dashboard = profile?.gender === "female" ? ROUTES.WOMEN_DASHBOARD : ROUTES.DASHBOARD;
        navigate(`${dashboard}?tab=groups`, { replace: true });
      } catch {
        if (!cancelled) navigate(`${ROUTES.DASHBOARD}?tab=groups`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default PrivateGroupsScreen;
