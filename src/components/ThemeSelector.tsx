import { useState } from 'react';
import { useAppTheme, THEMES, ThemeId, ThemeMode } from '@/contexts/ThemeContext';
import { themePreviewColor } from '@/contexts/themeRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Sun, Moon, Monitor, Palette, ChevronDown, ChevronUp } from 'lucide-react';

const MODE_OPTIONS: { id: ThemeMode; icon: typeof Sun; label: string }[] = [
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'system', icon: Monitor, label: 'System' },
];

function ThemeColorSwatch({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full shrink-0 shadow-md ring-2 ring-white/80'
      )}
      style={{ backgroundColor: themePreviewColor(color) }}
    />
  );
}

function ThemeLivePreview({ themeId }: { themeId: ThemeId }) {
  const theme = THEMES[themeId];
  const { preview } = theme;

  return (
    <div className="rounded-xl overflow-hidden border-2 border-white/35 shadow-lg">
      <div
        className="h-14 flex items-end gap-2 px-3 pb-2"
        style={{
          background: `linear-gradient(135deg, ${themePreviewColor(preview.primary)}, ${themePreviewColor(preview.accent)})`,
        }}
      >
        <div className="h-7 w-7 rounded-full bg-white/25 border border-white/45" />
        <div className="flex-1 space-y-1 pb-0.5">
          <div className="h-1.5 rounded-full bg-white/45 w-3/4" />
          <div className="h-1.5 rounded-full bg-white/30 w-1/2" />
        </div>
      </div>
      <div
        className="p-3 space-y-2"
        style={{ backgroundColor: themePreviewColor(preview.primary) }}
      >
        <div className="h-2 rounded bg-white/30" />
        <div className="h-2 rounded bg-white/22 w-5/6" />
        <div className="flex gap-2 pt-0.5">
          <div className="h-7 flex-1 rounded-lg bg-white/20 border border-white/25" />
          <div
            className="h-7 w-7 rounded-lg ring-1 ring-white/40"
            style={{ backgroundColor: themePreviewColor(preview.accent) }}
          />
        </div>
      </div>
      <p className="px-3 py-2 text-xs text-white/85 bg-black/15 border-t border-white/15">
        {theme.name} — {theme.description}
      </p>
    </div>
  );
}

interface ThemeSelectorProps {
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { themeId, mode, resolvedMode, setTheme, setMode } = useAppTheme();
  const t = (key: string, def: string) => def;
  const [showAllThemes, setShowAllThemes] = useState(false);

  const modeLabel = (optionId: ThemeMode, baseLabel: string) => {
    if (optionId === 'system' && mode === 'system') {
      return `${baseLabel} (${resolvedMode === 'dark' ? 'Dark' : 'Light'})`;
    }
    return baseLabel;
  };
  
  const themeEntries = Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][];
  const displayedThemes = showAllThemes ? themeEntries : themeEntries.slice(0, 8);

  const modePicker = (
    <div className="space-y-3 min-w-0">
      <Label className="text-sm font-medium">{t('theme', 'Theme Mode')}</Label>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 min-w-0">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => setMode(option.id)}
              className={cn(
                "flex flex-col items-center justify-center min-w-0 p-2.5 sm:p-4 rounded-xl border-2 transition-all duration-200",
                mode === option.id
                  ? "border-white bg-white/15"
                  : "border-white/25 hover:border-white/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2 shrink-0",
                mode === option.id ? "text-white" : "text-white/70"
              )} />
              <span className={cn(
                "text-[11px] sm:text-sm font-medium truncate w-full text-center",
                mode === option.id ? "text-white" : "text-white/70"
              )}>
                  {t(option.id, modeLabel(option.id, option.label))}
              </span>
              {mode === option.id && (
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white mt-1 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const livePreview = (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{t('themePreview', 'Theme Preview')}</Label>
      <ThemeLivePreview themeId={themeId} />
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
        {livePreview}
        <Separator className="bg-white/20" />
        {modePicker}
        <Separator className="bg-white/20" />

        {/* Color Theme — 2 cols on phones so card edges stay on-screen */}
        <div className="space-y-3 min-w-0">
          <Label className="text-sm font-medium">{t('colorTheme', 'Color Theme')}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
            {displayedThemes.map(([id, theme]) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 sm:gap-2 min-w-0 p-2 sm:p-3 rounded-xl border-2 transition-all duration-200",
                  themeId === id
                    ? "border-white bg-white/15"
                    : "border-white/25 hover:border-white/50"
                )}
                title={theme.description}
              >
                <div className="flex gap-1 shrink-0">
                  <ThemeColorSwatch color={theme.preview.primary} size="sm" />
                  <ThemeColorSwatch color={theme.preview.accent} size="sm" />
                </div>
                <span className={cn(
                  "text-[10px] sm:text-xs font-medium truncate w-full text-center px-0.5",
                  themeId === id ? "text-white" : "text-white/75"
                )}>
                  {theme.name}
                </span>
                {themeId === id && (
                  <Check className="absolute top-1 right-1 h-3 w-3 text-white" />
                )}
              </button>
            ))}
          </div>
          
          {themeEntries.length > 8 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllThemes(!showAllThemes)}
              className="w-full mt-2 text-white hover:text-white hover:bg-white/10"
            >
              {showAllThemes ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  {t('showLess', 'Show Less')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  {t('showAll', 'Show All')} ({themeEntries.length} {t('themes', 'themes')})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5 text-primary" />
          {t('appearance', 'Appearance')}
        </CardTitle>
        <CardDescription>{t('customizeAppLooks', 'Customize how the app looks')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {livePreview}
        <Separator />
        {modePicker}
        <Separator />

        {/* Color Theme Grid */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('colorTheme', 'Color Theme')}</Label>
          <ScrollArea className="h-96">
            <div className="grid grid-cols-2 gap-3 pr-4">
              {themeEntries.map(([id, theme]) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={cn(
                    "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    themeId === id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex gap-1.5">
                    <ThemeColorSwatch color={theme.preview.primary} />
                    <ThemeColorSwatch color={theme.preview.accent} />
                    <ThemeColorSwatch color={theme.preview.secondary} />
                  </div>
                  
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      themeId === id ? "text-primary" : "text-foreground"
                    )}>
                      {theme.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {theme.description}
                    </p>
                  </div>
                  
                  {themeId === id && (
                    <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
