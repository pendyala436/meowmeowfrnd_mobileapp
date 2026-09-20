import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Settings } from "lucide-react";

import { SettingsPanel } from "@/components/SettingsPanel";
import { supabase } from "@/integrations/supabase/client";

const SettingsScreen = () => {
  const navigate = useNavigate();
  const t = (key: string, def: string) => def;
  const [homePath, setHomePath] = useState("/dashboard");

  useEffect(() => {
    const detectHome = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("user_id", session.user.id)
        .single();
      if (profile?.gender?.toLowerCase() === "female") {
        setHomePath("/women-dashboard");
      }
    };
    detectHome();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground w-full max-w-full overflow-x-hidden">
      <header
        data-app-header
        className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 min-w-0">
          <Button
            variant="auroraGhost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="auroraGhost"
            size="icon"
            onClick={() => navigate(homePath)}
            className="rounded-full shrink-0"
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2 min-w-0 truncate">
            <Settings className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("settings", "Settings")}</span>
          </h1>
        </div>
      </header>

      <main data-app-body className="w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-4 pb-8 min-w-0">
          <SettingsPanel />
        </div>
      </main>
    </div>
  );
};

export default SettingsScreen;
