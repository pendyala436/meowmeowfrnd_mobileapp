// Auto-generated — FRND default + 30 pack themes + 20 legacy themes (51 total)
export interface ThemePreview {
  primary: string;
  accent: string;
  secondary: string;
  vip?: string;
}

/** Build a CSS hsl() color from theme preview token values (e.g. "335 100% 58%"). */
export function themePreviewColor(value: string): string {
  return `hsl(${value})`;
}

/** Convert HSL components (H 0–360, S/L 0–100) to a #rrggbb hex string. */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Parse token strings like "24 88% 46%" (optionally with "/ alpha") into #rrggbb.
 * Falls back to FRND pink when parsing fails.
 */
export function themeTokenToHex(token: string, fallback = "#FF2B85"): string {
  const match = token.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return fallback;
  return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  preview: ThemePreview;
}

export const THEMES = {
  frnd: {
    id: "frnd",
    name: "FRND Pink",
    description: "Default brand theme — vibrant hot pink",
    preview: {
      primary: "335 100% 58%",
      accent: "218 75% 60%",
      secondary: "335 100% 96%",
    },
  },
  "sunset-coral": {
    id: "sunset-coral",
    name: "Sunset Coral",
    description: "Sunset Coral palette",
    preview: {
      primary: "0 88% 46%",
      accent: "218 75% 60%",
      secondary: "0 90% 96%",
      vip: "200 55% 46%",
    },
  },
  "cherry-blaze": {
    id: "cherry-blaze",
    name: "Cherry Blaze",
    description: "Cherry Blaze palette",
    preview: {
      primary: "12 88% 46%",
      accent: "218 75% 60%",
      secondary: "12 90% 96%",
      vip: "212 55% 46%",
    },
  },
  "rose-ember": {
    id: "rose-ember",
    name: "Rose Ember",
    description: "Rose Ember palette",
    preview: {
      primary: "24 88% 46%",
      accent: "218 75% 60%",
      secondary: "24 90% 96%",
      vip: "224 55% 46%",
    },
  },
  "marigold-punch": {
    id: "marigold-punch",
    name: "Marigold Punch",
    description: "Marigold Punch palette",
    preview: {
      primary: "36 88% 46%",
      accent: "218 75% 60%",
      secondary: "36 90% 96%",
      vip: "236 55% 46%",
    },
  },
  "golden-hour": {
    id: "golden-hour",
    name: "Golden Hour",
    description: "Golden Hour palette",
    preview: {
      primary: "48 88% 55%",
      accent: "218 75% 60%",
      secondary: "48 90% 96%",
      vip: "248 55% 46%",
    },
  },
  "chartreuse-zing": {
    id: "chartreuse-zing",
    name: "Chartreuse Zing",
    description: "Chartreuse Zing palette",
    preview: {
      primary: "60 88% 55%",
      accent: "218 75% 60%",
      secondary: "60 90% 96%",
      vip: "260 55% 46%",
    },
  },
  "lime-spark": {
    id: "lime-spark",
    name: "Lime Spark",
    description: "Lime Spark palette",
    preview: {
      primary: "72 88% 55%",
      accent: "218 75% 60%",
      secondary: "72 90% 96%",
      vip: "272 55% 46%",
    },
  },
  "meadow-fresh": {
    id: "meadow-fresh",
    name: "Meadow Fresh",
    description: "Meadow Fresh palette",
    preview: {
      primary: "84 88% 55%",
      accent: "218 75% 60%",
      secondary: "84 90% 96%",
      vip: "284 55% 46%",
    },
  },
  "fern-signal": {
    id: "fern-signal",
    name: "Fern Signal",
    description: "Fern Signal palette",
    preview: {
      primary: "96 88% 52%",
      accent: "218 75% 60%",
      secondary: "96 90% 96%",
      vip: "296 55% 46%",
    },
  },
  "pine-verified": {
    id: "pine-verified",
    name: "Pine Verified",
    description: "Pine Verified palette",
    preview: {
      primary: "108 88% 52%",
      accent: "218 75% 60%",
      secondary: "108 90% 96%",
      vip: "308 55% 40%",
    },
  },
  "emerald-current": {
    id: "emerald-current",
    name: "Emerald Current",
    description: "Emerald Current palette",
    preview: {
      primary: "120 88% 52%",
      accent: "218 75% 60%",
      secondary: "120 90% 96%",
      vip: "320 55% 40%",
    },
  },
  "teal-tide": {
    id: "teal-tide",
    name: "Teal Tide",
    description: "Teal Tide palette",
    preview: {
      primary: "132 88% 52%",
      accent: "218 75% 60%",
      secondary: "132 90% 96%",
      vip: "332 55% 40%",
    },
  },
  "aqua-mint": {
    id: "aqua-mint",
    name: "Aqua Mint",
    description: "Aqua Mint palette",
    preview: {
      primary: "144 88% 52%",
      accent: "218 75% 60%",
      secondary: "144 90% 96%",
      vip: "344 55% 40%",
    },
  },
  "cyan-pulse": {
    id: "cyan-pulse",
    name: "Cyan Pulse",
    description: "Cyan Pulse palette",
    preview: {
      primary: "156 88% 52%",
      accent: "218 75% 60%",
      secondary: "156 90% 96%",
      vip: "356 55% 40%",
    },
  },
  "sky-signal": {
    id: "sky-signal",
    name: "Sky Signal",
    description: "Sky Signal palette",
    preview: {
      primary: "168 88% 52%",
      accent: "218 75% 60%",
      secondary: "168 90% 96%",
      vip: "8 55% 40%",
    },
  },
  "azure-wave": {
    id: "azure-wave",
    name: "Azure Wave",
    description: "Azure Wave palette",
    preview: {
      primary: "180 88% 52%",
      accent: "218 75% 60%",
      secondary: "180 90% 96%",
      vip: "20 55% 40%",
    },
  },
  "cobalt-rush": {
    id: "cobalt-rush",
    name: "Cobalt Rush",
    description: "Cobalt Rush palette",
    preview: {
      primary: "192 88% 52%",
      accent: "218 75% 60%",
      secondary: "192 90% 96%",
      vip: "32 55% 40%",
    },
  },
  "sapphire-glow": {
    id: "sapphire-glow",
    name: "Sapphire Glow",
    description: "Sapphire Glow palette",
    preview: {
      primary: "204 88% 52%",
      accent: "218 75% 60%",
      secondary: "204 90% 96%",
      vip: "44 55% 49%",
    },
  },
  "indigo-spark": {
    id: "indigo-spark",
    name: "Indigo Spark",
    description: "Indigo Spark palette",
    preview: {
      primary: "216 88% 52%",
      accent: "218 75% 60%",
      secondary: "216 90% 96%",
      vip: "56 55% 49%",
    },
  },
  "violet-flame": {
    id: "violet-flame",
    name: "Violet Flame",
    description: "Violet Flame palette",
    preview: {
      primary: "228 88% 52%",
      accent: "218 75% 60%",
      secondary: "228 90% 96%",
      vip: "68 55% 49%",
    },
  },
  "amethyst-bloom": {
    id: "amethyst-bloom",
    name: "Amethyst Bloom",
    description: "Amethyst Bloom palette",
    preview: {
      primary: "240 88% 52%",
      accent: "218 75% 60%",
      secondary: "240 90% 96%",
      vip: "80 55% 49%",
    },
  },
  "orchid-pop": {
    id: "orchid-pop",
    name: "Orchid Pop",
    description: "Orchid Pop palette",
    preview: {
      primary: "252 88% 52%",
      accent: "218 75% 60%",
      secondary: "252 90% 96%",
      vip: "92 55% 46%",
    },
  },
  "plum-velvet": {
    id: "plum-velvet",
    name: "Plum Velvet",
    description: "Plum Velvet palette",
    preview: {
      primary: "264 88% 52%",
      accent: "218 75% 60%",
      secondary: "264 90% 96%",
      vip: "104 55% 46%",
    },
  },
  "magenta-pulse": {
    id: "magenta-pulse",
    name: "Magenta Pulse",
    description: "Magenta Pulse palette",
    preview: {
      primary: "276 88% 52%",
      accent: "218 75% 60%",
      secondary: "276 90% 96%",
      vip: "116 55% 46%",
    },
  },
  "fuchsia-burst": {
    id: "fuchsia-burst",
    name: "Fuchsia Burst",
    description: "Fuchsia Burst palette",
    preview: {
      primary: "288 88% 52%",
      accent: "218 75% 60%",
      secondary: "288 90% 96%",
      vip: "128 55% 46%",
    },
  },
  "berry-crush": {
    id: "berry-crush",
    name: "Berry Crush",
    description: "Berry Crush palette",
    preview: {
      primary: "300 88% 46%",
      accent: "218 75% 60%",
      secondary: "300 90% 96%",
      vip: "140 55% 46%",
    },
  },
  "rose-quartz": {
    id: "rose-quartz",
    name: "Rose Quartz",
    description: "Rose Quartz palette",
    preview: {
      primary: "312 88% 46%",
      accent: "218 75% 60%",
      secondary: "312 90% 96%",
      vip: "152 55% 46%",
    },
  },
  "coral-blush": {
    id: "coral-blush",
    name: "Coral Blush",
    description: "Coral Blush palette",
    preview: {
      primary: "324 88% 46%",
      accent: "218 75% 60%",
      secondary: "324 90% 96%",
      vip: "164 55% 46%",
    },
  },
  "watermelon-pop": {
    id: "watermelon-pop",
    name: "Watermelon Pop",
    description: "Watermelon Pop palette",
    preview: {
      primary: "336 88% 46%",
      accent: "218 75% 60%",
      secondary: "336 90% 96%",
      vip: "176 55% 46%",
    },
  },
  "bubblegum-bright": {
    id: "bubblegum-bright",
    name: "Bubblegum Bright",
    description: "Bubblegum Bright palette",
    preview: {
      primary: "348 88% 46%",
      accent: "218 75% 60%",
      secondary: "348 90% 96%",
      vip: "188 55% 46%",
    },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    description: "Cosmic teal with aurora glow",
    preview: {
      primary: "174 72% 40%",
      accent: "160 70% 42%",
      secondary: "270 50% 94%",
    },
  },
  pink: {
    id: "pink",
    name: "Rose Blossom",
    description: "Soft pink with romantic vibes",
    preview: {
      primary: "330 81% 60%",
      accent: "340 75% 55%",
      secondary: "320 50% 94%",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean Blue",
    description: "Deep ocean with calm waves",
    preview: {
      primary: "210 90% 50%",
      accent: "190 85% 45%",
      secondary: "200 50% 94%",
    },
  },
  forest: {
    id: "forest",
    name: "Forest Green",
    description: "Natural green forest vibes",
    preview: {
      primary: "142 71% 45%",
      accent: "160 60% 40%",
      secondary: "140 50% 94%",
    },
  },
  sunset: {
    id: "sunset",
    name: "Sunset Orange",
    description: "Warm sunset glow",
    preview: {
      primary: "25 95% 53%",
      accent: "15 90% 50%",
      secondary: "30 50% 94%",
    },
  },
  lavender: {
    id: "lavender",
    name: "Lavender Dream",
    description: "Soft purple lavender fields",
    preview: {
      primary: "270 65% 60%",
      accent: "280 60% 55%",
      secondary: "270 50% 94%",
    },
  },
  crimson: {
    id: "crimson",
    name: "Crimson Red",
    description: "Bold crimson passion",
    preview: {
      primary: "350 80% 50%",
      accent: "0 75% 55%",
      secondary: "350 50% 94%",
    },
  },
  gold: {
    id: "gold",
    name: "Golden Amber",
    description: "Luxurious gold and amber",
    preview: {
      primary: "45 90% 48%",
      accent: "38 85% 50%",
      secondary: "45 50% 94%",
    },
  },
  mint: {
    id: "mint",
    name: "Fresh Mint",
    description: "Cool refreshing mint",
    preview: {
      primary: "165 72% 45%",
      accent: "155 65% 42%",
      secondary: "165 50% 94%",
    },
  },
  slate: {
    id: "slate",
    name: "Slate Gray",
    description: "Modern neutral slate",
    preview: {
      primary: "215 25% 45%",
      accent: "220 20% 50%",
      secondary: "215 20% 94%",
    },
  },
  cherry: {
    id: "cherry",
    name: "Cherry Blossom",
    description: "Japanese cherry blossom",
    preview: {
      primary: "340 80% 65%",
      accent: "350 75% 60%",
      secondary: "340 50% 94%",
    },
  },
  cobalt: {
    id: "cobalt",
    name: "Cobalt Blue",
    description: "Deep rich cobalt",
    preview: {
      primary: "225 85% 55%",
      accent: "230 80% 50%",
      secondary: "225 50% 94%",
    },
  },
  coral: {
    id: "coral",
    name: "Coral Reef",
    description: "Vibrant coral tones",
    preview: {
      primary: "16 85% 60%",
      accent: "10 80% 55%",
      secondary: "16 50% 94%",
    },
  },
  wine: {
    id: "wine",
    name: "Wine Berry",
    description: "Rich wine and berry",
    preview: {
      primary: "310 60% 45%",
      accent: "320 55% 50%",
      secondary: "310 50% 94%",
    },
  },
  midnight: {
    id: "midnight",
    name: "Midnight Indigo",
    description: "Deep midnight sky",
    preview: {
      primary: "245 70% 55%",
      accent: "255 65% 50%",
      secondary: "245 50% 94%",
    },
  },
  peach: {
    id: "peach",
    name: "Peach Blush",
    description: "Soft warm peach",
    preview: {
      primary: "20 85% 65%",
      accent: "12 80% 60%",
      secondary: "20 50% 94%",
    },
  },
  emerald: {
    id: "emerald",
    name: "Emerald Gem",
    description: "Precious emerald green",
    preview: {
      primary: "155 80% 40%",
      accent: "145 75% 38%",
      secondary: "155 50% 94%",
    },
  },
  sapphire: {
    id: "sapphire",
    name: "Royal Sapphire",
    description: "Royal blue sapphire",
    preview: {
      primary: "220 85% 50%",
      accent: "228 80% 55%",
      secondary: "220 50% 94%",
    },
  },
  rose: {
    id: "rose",
    name: "Rose Gold",
    description: "Elegant rose gold",
    preview: {
      primary: "345 75% 60%",
      accent: "355 70% 55%",
      secondary: "345 50% 94%",
    },
  },
} as const satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME_ID: ThemeId = "frnd";

export function normalizeThemeId(stored: string | null): ThemeId {
  if (stored && stored in THEMES) return stored as ThemeId;
  return DEFAULT_THEME_ID;
}

/** Hex color for browser/system chrome from a theme's preview primary. */
export function getThemeChromeHex(themeId: ThemeId, dark = false): string {
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID];
  const primary = theme.preview.primary;
  if (!dark) return themeTokenToHex(primary);
  // Dark chrome: same hue/sat, slightly deeper lightness for status/nav bars
  const match = primary.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return "#1a0a12";
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Math.max(18, Number(match[3]) * 0.55);
  return hslToHex(h, s, l);
}
