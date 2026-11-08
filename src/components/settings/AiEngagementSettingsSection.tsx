import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Moon, Clock, ShieldCheck, HeartHandshake, Check, Loader2 } from "lucide-react";

export interface EngagementPrefs {
  proactive_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  max_proactive_per_day: number;
  min_hours_between_messages: number;
  timezone: string;
}

export function AiEngagementSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<EngagementPrefs>({
    proactive_enabled: false,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    max_proactive_per_day: 1,
    min_hours_between_messages: 24,
    timezone: "Asia/Kolkata",
  });
  const [originalPrefs, setOriginalPrefs] = useState<EngagementPrefs>(prefs);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("ai_user_engagement_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!error && data) {
        const loaded: EngagementPrefs = {
          proactive_enabled: !!data.proactive_enabled,
          quiet_hours_start: data.quiet_hours_start ?? 22,
          quiet_hours_end: data.quiet_hours_end ?? 8,
          max_proactive_per_day: data.max_proactive_per_day ?? 1,
          min_hours_between_messages: data.min_hours_between_messages ?? 24,
          timezone: data.timezone || "Asia/Kolkata",
        };
        setPrefs(loaded);
        setOriginalPrefs(loaded);
      }
    } catch (err) {
      console.error("Failed to load engagement preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof EngagementPrefs>(key: K, value: EngagementPrefs[K]) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalPrefs));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please log in to save settings");
        return;
      }

      // Client-side validations
      if (prefs.max_proactive_per_day < 1 || prefs.max_proactive_per_day > 5) {
        toast.error("Daily messages must be between 1 and 5");
        return;
      }
      if (prefs.min_hours_between_messages < 6) {
        toast.error("Minimum interval must be at least 6 hours");
        return;
      }

      const { error } = await supabase
        .from("ai_user_engagement_preferences")
        .upsert({
          user_id: session.user.id,
          proactive_enabled: prefs.proactive_enabled,
          quiet_hours_start: prefs.quiet_hours_start,
          quiet_hours_end: prefs.quiet_hours_end,
          max_proactive_per_day: prefs.max_proactive_per_day,
          min_hours_between_messages: prefs.min_hours_between_messages,
          timezone: prefs.timezone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setOriginalPrefs(prefs);
      setHasChanges(false);
      toast.success("AI engagement preferences saved successfully!");
    } catch (err: any) {
      console.error("Error saving preferences:", err);
      toast.error(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500 shrink-0" />
            <CardTitle className="text-base sm:text-lg font-semibold">
              AI Companion Follow-ups & Check-ins
            </CardTitle>
          </div>
          <Badge variant={prefs.proactive_enabled ? "default" : "secondary"} className="text-xs">
            {prefs.proactive_enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Control whether your AI companions can reach out with friendly check-ins about your presentations, projects, or shared interests.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-1">
        {/* Master Opt-in Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/30">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="master-proactive-toggle" className="text-sm font-medium cursor-pointer">
              Allow Proactive Check-ins
            </Label>
            <p className="text-xs text-muted-foreground">
              When disabled, companions will only speak when you message them first.
            </p>
          </div>
          <Switch
            id="master-proactive-toggle"
            checked={prefs.proactive_enabled}
            disabled={loading}
            onCheckedChange={(checked) => updateField("proactive_enabled", checked)}
          />
        </div>

        {prefs.proactive_enabled && (
          <div className="space-y-4 pt-1 border-t border-border/40">
            {/* Quiet Hours */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Moon className="h-4 w-4 text-purple-400" />
                <span>Quiet Hours (Do Not Disturb)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Companions will never message you during this time.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Select
                    value={prefs.quiet_hours_start.toString()}
                    onValueChange={(val) => updateField("quiet_hours_start", parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()} className="text-xs">
                          {i === 0 ? "12:00 AM (Midnight)" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM (Noon)" : `${i - 12}:00 PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Select
                    value={prefs.quiet_hours_end.toString()}
                    onValueChange={(val) => updateField("quiet_hours_end", parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()} className="text-xs">
                          {i === 0 ? "12:00 AM (Midnight)" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM (Noon)" : `${i - 12}:00 PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Daily Message Limit */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-blue-400" />
                <span>Max Messages Per Day</span>
              </div>
              <Select
                value={prefs.max_proactive_per_day.toString()}
                onValueChange={(val) => updateField("max_proactive_per_day", parseInt(val, 10))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select daily cap" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-xs">1 message per day (Default)</SelectItem>
                  <SelectItem value="2" className="text-xs">2 messages per day</SelectItem>
                  <SelectItem value="3" className="text-xs">3 messages per day</SelectItem>
                  <SelectItem value="5" className="text-xs">5 messages per day (Maximum)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Minimum Cooldown Interval */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Minimum Time Between Follow-ups</span>
              </div>
              <Select
                value={prefs.min_hours_between_messages.toString()}
                onValueChange={(val) => updateField("min_hours_between_messages", parseInt(val, 10))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select cooldown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6" className="text-xs">6 hours</SelectItem>
                  <SelectItem value="12" className="text-xs">12 hours</SelectItem>
                  <SelectItem value="24" className="text-xs">24 hours (Recommended)</SelectItem>
                  <SelectItem value="48" className="text-xs">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
