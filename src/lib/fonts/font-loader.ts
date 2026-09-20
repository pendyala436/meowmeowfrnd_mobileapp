/**
 * On-Demand Font Loading System
 *
 * This module provides lazy loading of Google Noto fonts based on detected scripts.
 * Fonts are only loaded when text in that script is encountered, preventing
 * performance degradation from loading all 900+ language fonts upfront.
 */

// Track which font groups have been loaded
const loadedFontGroups = new Set<string>();

// Track loading promises to prevent duplicate requests
const loadingPromises = new Map<string, Promise<void>>();

// Font group definitions with their Google Fonts URLs
const FONT_GROUPS: Record<string, { url: string; scripts: string[] }> = {
  // Base Latin/Cyrillic/Greek (always loaded as fallback)
  base: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Mono:wght@400;500&display=swap",
    scripts: ["latin", "cyrillic", "greek"],
  },

  // Indic scripts
  indic: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&family=Noto+Sans+Gurmukhi:wght@400;500;600;700&family=Noto+Sans+Oriya:wght@400;500;600;700&family=Noto+Sans+Sinhala:wght@400;500;600;700&display=swap",
    scripts: [
      "devanagari",
      "bengali",
      "tamil",
      "telugu",
      "kannada",
      "malayalam",
      "gujarati",
      "gurmukhi",
      "oriya",
      "sinhala",
    ],
  },

  // Arabic/Hebrew/RTL scripts
  rtl: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans+Hebrew:wght@400;500;600;700&family=Noto+Sans+Syriac:wght@400&family=Noto+Sans+Thaana:wght@400;500&display=swap",
    scripts: ["arabic", "hebrew", "syriac", "thaana"],
  },

  // Southeast Asian
  sea: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Sans+Lao:wght@400;500;600;700&family=Noto+Sans+Khmer:wght@400;500;600;700&family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap",
    scripts: ["thai", "lao", "khmer", "myanmar"],
  },

  // CJK (Chinese, Japanese, Korean)
  cjk: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+KR:wght@400;500;700&display=swap",
    scripts: ["han", "hiragana", "katakana", "hangul", "bopomofo"],
  },

  // Central Asian + Caucasian
  caucasian: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@400;500;600;700&family=Noto+Sans+Georgian:wght@400;500;600;700&family=Noto+Sans+Mongolian&family=Noto+Sans+Tibetan:wght@400;700&display=swap",
    scripts: ["armenian", "georgian", "mongolian", "tibetan"],
  },

  // African scripts
  african: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&family=Noto+Sans+Tifinagh&family=Noto+Sans+Vai&family=Noto+Sans+NKo:wght@400;500&family=Noto+Sans+Bamum&family=Noto+Sans+Adlam:wght@400;500;600;700&display=swap",
    scripts: ["ethiopic", "tifinagh", "vai", "nko", "bamum", "adlam"],
  },

  // Indonesian/Philippine scripts
  indonesian: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Javanese:wght@400;700&family=Noto+Sans+Balinese:wght@400;700&family=Noto+Sans+Sundanese:wght@400;700&family=Noto+Sans+Buginese&family=Noto+Sans+Tagalog&display=swap",
    scripts: ["javanese", "balinese", "sundanese", "buginese", "tagalog"],
  },

  // Native American + Historic
  native: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Canadian+Aboriginal:wght@400;500;600;700&family=Noto+Sans+Cherokee:wght@400;500;600;700&display=swap",
    scripts: ["canadian_aboriginal", "cherokee"],
  },

  // Additional South Asian
  southasian: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Limbu&family=Noto+Sans+Lepcha&family=Noto+Sans+Ol+Chiki:wght@400;500;600;700&family=Noto+Sans+Meetei+Mayek:wght@400;500;600;700&family=Noto+Sans+Chakma&family=Noto+Sans+Syloti+Nagri&display=swap",
    scripts: ["limbu", "lepcha", "ol_chiki", "meetei_mayek", "chakma", "syloti_nagri"],
  },

  // Brahmic derivatives
  brahmic: {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Cham:wght@400;700&family=Noto+Sans+Tai+Tham:wght@400;500&family=Noto+Sans+Tai+Viet&family=Noto+Sans+Kayah+Li:wght@400;500;700&family=Noto+Sans+Pahawh+Hmong&family=Noto+Sans+Miao&display=swap",
    scripts: ["cham", "tai_tham", "tai_viet", "kayah_li", "pahawh_hmong", "miao"],
  },
};

// Unicode script ranges for detection
const SCRIPT_RANGES: [number, number, string][] = [
  // Latin extended
  [0x0000, 0x024f, "latin"],
  [0x1e00, 0x1eff, "latin"],

  // Cyrillic
  [0x0400, 0x04ff, "cyrillic"],
  [0x0500, 0x052f, "cyrillic"],

  // Greek
  [0x0370, 0x03ff, "greek"],
  [0x1f00, 0x1fff, "greek"],

  // Arabic
  [0x0600, 0x06ff, "arabic"],
  [0x0750, 0x077f, "arabic"],
  [0x08a0, 0x08ff, "arabic"],
  [0xfb50, 0xfdff, "arabic"],
  [0xfe70, 0xfeff, "arabic"],

  // Hebrew
  [0x0590, 0x05ff, "hebrew"],
  [0xfb1d, 0xfb4f, "hebrew"],

  // Devanagari
  [0x0900, 0x097f, "devanagari"],
  [0xa8e0, 0xa8ff, "devanagari"],

  // Bengali
  [0x0980, 0x09ff, "bengali"],

  // Tamil
  [0x0b80, 0x0bff, "tamil"],

  // Telugu
  [0x0c00, 0x0c7f, "telugu"],

  // Kannada
  [0x0c80, 0x0cff, "kannada"],

  // Malayalam
  [0x0d00, 0x0d7f, "malayalam"],

  // Gujarati
  [0x0a80, 0x0aff, "gujarati"],

  // Gurmukhi (Punjabi)
  [0x0a00, 0x0a7f, "gurmukhi"],

  // Oriya
  [0x0b00, 0x0b7f, "oriya"],

  // Sinhala
  [0x0d80, 0x0dff, "sinhala"],

  // Thai
  [0x0e00, 0x0e7f, "thai"],

  // Lao
  [0x0e80, 0x0eff, "lao"],

  // Khmer
  [0x1780, 0x17ff, "khmer"],
  [0x19e0, 0x19ff, "khmer"],

  // Myanmar
  [0x1000, 0x109f, "myanmar"],
  [0xaa60, 0xaa7f, "myanmar"],

  // CJK
  [0x4e00, 0x9fff, "han"],
  [0x3400, 0x4dbf, "han"],
  [0x20000, 0x2a6df, "han"],
  [0x2a700, 0x2b73f, "han"],
  [0xf900, 0xfaff, "han"],

  // Japanese
  [0x3040, 0x309f, "hiragana"],
  [0x30a0, 0x30ff, "katakana"],
  [0x31f0, 0x31ff, "katakana"],

  // Korean
  [0xac00, 0xd7af, "hangul"],
  [0x1100, 0x11ff, "hangul"],
  [0x3130, 0x318f, "hangul"],

  // Armenian
  [0x0530, 0x058f, "armenian"],
  [0xfb00, 0xfb17, "armenian"],

  // Georgian
  [0x10a0, 0x10ff, "georgian"],
  [0x2d00, 0x2d2f, "georgian"],

  // Ethiopic
  [0x1200, 0x137f, "ethiopic"],
  [0x1380, 0x139f, "ethiopic"],
  [0x2d80, 0x2ddf, "ethiopic"],

  // Tibetan
  [0x0f00, 0x0fff, "tibetan"],

  // Mongolian
  [0x1800, 0x18af, "mongolian"],

  // Thaana (Maldivian)
  [0x0780, 0x07bf, "thaana"],

  // Syriac
  [0x0700, 0x074f, "syriac"],

  // Canadian Aboriginal
  [0x1400, 0x167f, "canadian_aboriginal"],
  [0x18b0, 0x18ff, "canadian_aboriginal"],

  // Cherokee
  [0x13a0, 0x13ff, "cherokee"],
  [0xab70, 0xabbf, "cherokee"],

  // Javanese
  [0xa980, 0xa9df, "javanese"],

  // Balinese
  [0x1b00, 0x1b7f, "balinese"],

  // Sundanese
  [0x1b80, 0x1bbf, "sundanese"],

  // Tagalog
  [0x1700, 0x171f, "tagalog"],

  // Tifinagh
  [0x2d30, 0x2d7f, "tifinagh"],

  // Vai
  [0xa500, 0xa63f, "vai"],

  // N'Ko
  [0x07c0, 0x07ff, "nko"],

  // Adlam
  [0x1e900, 0x1e95f, "adlam"],

  // Limbu
  [0x1900, 0x194f, "limbu"],

  // Lepcha
  [0x1c00, 0x1c4f, "lepcha"],

  // Ol Chiki
  [0x1c50, 0x1c7f, "ol_chiki"],

  // Meetei Mayek
  [0xabc0, 0xabff, "meetei_mayek"],
  [0xaae0, 0xaaff, "meetei_mayek"],

  // Cham
  [0xaa00, 0xaa5f, "cham"],

  // Tai Tham
  [0x1a20, 0x1aaf, "tai_tham"],

  // Tai Viet
  [0xaa80, 0xaadf, "tai_viet"],

  // Kayah Li
  [0xa900, 0xa92f, "kayah_li"],
];

/**
 * Detect scripts present in the given text
 */
export function detectScripts(text: string): Set<string> {
  const scripts = new Set<string>();

  for (let i = 0; i < text.length; i++) {
    const codePoint = text.codePointAt(i);
    if (codePoint === undefined) continue;

    // Skip if already found enough scripts (performance optimization)
    if (scripts.size > 3) break;

    for (const [start, end, script] of SCRIPT_RANGES) {
      if (codePoint >= start && codePoint <= end) {
        scripts.add(script);
        break;
      }
    }

    // Handle surrogate pairs
    if (codePoint > 0xffff) i++;
  }

  return scripts;
}

/**
 * Get font group for a script
 */
function getFontGroupForScript(script: string): string | null {
  for (const [groupName, group] of Object.entries(FONT_GROUPS)) {
    if (group.scripts.includes(script)) {
      return groupName;
    }
  }
  return null;
}

/**
 * Load a font group by injecting a stylesheet link
 */
async function loadFontGroup(groupName: string): Promise<void> {
  // Already loaded
  if (loadedFontGroups.has(groupName)) {
    return Promise.resolve();
  }

  // Already loading
  if (loadingPromises.has(groupName)) {
    return loadingPromises.get(groupName)!;
  }

  const group = FONT_GROUPS[groupName];
  if (!group) {
    return Promise.resolve();
  }

  const promise = new Promise<void>((resolve, reject) => {
    // Check if link already exists
    const existingLink = document.querySelector(`link[data-font-group="${groupName}"]`);
    if (existingLink) {
      loadedFontGroups.add(groupName);
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = group.url;
    link.crossOrigin = "anonymous";
    link.setAttribute("data-font-group", groupName);
    link.setAttribute("media", "print");

    link.onload = () => {
      // Switch from print to all media to apply fonts
      link.media = "all";
      loadedFontGroups.add(groupName);
      loadingPromises.delete(groupName);
      resolve();
    };

    link.onerror = () => {
      loadingPromises.delete(groupName);
      // Mark as loaded to prevent retry loops — system fonts serve as fallback
      loadedFontGroups.add(groupName);
      console.warn(
        `[FontLoader] Failed to load font group "${groupName}" — using system fallback fonts. This may be caused by Content Security Policy restrictions.`,
      );
      resolve(); // Resolve instead of reject so callers don't need error handling
    };

    document.head.appendChild(link);
  });

  loadingPromises.set(groupName, promise);
  return promise;
}

/**
 * Load fonts required for the given text
 * This is the main entry point - call this when text needs to be displayed
 */
export async function loadFontsForText(text: string): Promise<void> {
  if (!text || text.length === 0) return;

  const scripts = detectScripts(text);
  const groupsToLoad = new Set<string>();

  for (const script of scripts) {
    const group = getFontGroupForScript(script);
    if (group && !loadedFontGroups.has(group)) {
      groupsToLoad.add(group);
    }
  }

  if (groupsToLoad.size === 0) return;

  // Load all required groups in parallel
  await Promise.all(
    Array.from(groupsToLoad).map((group) =>
      loadFontGroup(group).catch((err) => {
        console.warn(`Font loading warning:`, err.message);
      }),
    ),
  );
}

/**
 * Load fonts for a specific language code
 */
export async function loadFontsForLanguage(langCode: string): Promise<void> {
  const languageToGroup: Record<string, string> = {
    // Indic languages
    hi: "indic",
    mr: "indic",
    ne: "indic",
    sa: "indic", // Devanagari
    bn: "indic",
    as: "indic", // Bengali
    ta: "indic", // Tamil
    te: "indic", // Telugu
    kn: "indic", // Kannada
    ml: "indic", // Malayalam
    gu: "indic", // Gujarati
    pa: "indic", // Punjabi (Gurmukhi)
    or: "indic", // Oriya
    si: "indic", // Sinhala

    // RTL languages
    ar: "rtl",
    fa: "rtl",
    ur: "rtl",
    ps: "rtl", // Arabic script
    he: "rtl",
    yi: "rtl", // Hebrew
    dv: "rtl", // Dhivehi (Thaana)

    // Southeast Asian
    th: "sea", // Thai
    lo: "sea", // Lao
    km: "sea", // Khmer
    my: "sea", // Myanmar

    // CJK
    zh: "cjk",
    "zh-CN": "cjk",
    "zh-TW": "cjk",
    "zh-HK": "cjk",
    ja: "cjk", // Japanese
    ko: "cjk", // Korean

    // Caucasian
    hy: "caucasian", // Armenian
    ka: "caucasian", // Georgian
    mn: "caucasian", // Mongolian
    bo: "caucasian", // Tibetan

    // African
    am: "african",
    ti: "african", // Ethiopic
    tzm: "african", // Tifinagh
    vai: "african", // Vai
    nqo: "african", // N'Ko
    ff: "african", // Fulah (Adlam)

    // Indonesian
    jv: "indonesian", // Javanese
    su: "indonesian", // Sundanese
    ban: "indonesian", // Balinese
    tl: "indonesian",
    fil: "indonesian", // Tagalog

    // Native
    cr: "native",
    oj: "native",
    iu: "native", // Canadian Aboriginal
    chr: "native", // Cherokee

    // South Asian minority
    lif: "southasian", // Limbu
    lep: "southasian", // Lepcha
    sat: "southasian", // Santali (Ol Chiki)
    mni: "southasian", // Manipuri (Meetei Mayek)
    ccp: "southasian", // Chakma
    syl: "southasian", // Sylheti

    // Brahmic
    cjm: "brahmic", // Cham
    lana: "brahmic", // Tai Tham
    tdd: "brahmic", // Tai Dam (Tai Viet)
    kyu: "brahmic", // Kayah
  };

  const normalizedCode = langCode.toLowerCase().split("-")[0];
  const group = languageToGroup[langCode] || languageToGroup[normalizedCode];

  if (group) {
    await loadFontGroup(group);
  }
}

/**
 * Preload base fonts (Latin/Cyrillic/Greek)
 * Call this on app initialization
 */
export function preloadBaseFonts(): void {
  loadFontGroup("base").catch(() => {
    // Silently fail - system fonts will be used as fallback
  });
}

/**
 * Get list of loaded font groups (for debugging)
 */
export function getLoadedFontGroups(): string[] {
  return Array.from(loadedFontGroups);
}

/**
 * Check if fonts are loaded for a specific script
 */
export function isFontLoadedForScript(script: string): boolean {
  const group = getFontGroupForScript(script);
  return group ? loadedFontGroups.has(group) : true;
}
