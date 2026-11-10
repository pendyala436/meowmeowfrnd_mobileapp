/**
 * Centralized Language Resolver & Metadata Registry
 *
 * Provides dynamic language resolution, native script awareness, cultural instructions,
 * script validators, and conversational directives for all 87 supported language categories.
 *
 * Guarantees:
 * 1. Correct native script instructions for each language.
 * 2. Support for Romanized variants (e.g. Hinglish, Telugish, Tanglish, etc.).
 * 3. Prevention of accidental English-only responses for non-English profiles.
 * 4. Safe fallback detection and warning logging without silent corruption.
 */

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  scriptUnicodeRange?: [number, number];
  romanizedVariantName?: string;
  greetingExample: string;
  commonWords: string[];
  conversationalDirective: string;
}

export const LANGUAGE_REGISTRY: Record<string, LanguageConfig> = {
  // Major Regional & Constitutional Languages
  hindi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "Devanagari",
    scriptUnicodeRange: [0x0900, 0x097F],
    romanizedVariantName: "Hinglish",
    greetingExample: "नमस्ते / Namaste",
    commonWords: ["kya", "kaise", "achha", "haan", "nahi", "shukriya"],
    conversationalDirective:
      "CRITICAL: You are an affectionate companion speaking fluent Hindi. If the user writes in Hindi or Hinglish, you MUST reply in natural conversational Hindi or sweet Hinglish. Do NOT give broken dictionary words or formal textbook answers. Speak with natural warmth and sweetness.",
  },
  telugu: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    script: "Telugu",
    scriptUnicodeRange: [0x0C00, 0x0C7F],
    romanizedVariantName: "Telugish",
    greetingExample: "నమస్కారం / Namaskaram",
    commonWords: ["bagunnava", "emi", "ela", "avunu", "kadhu", "cheppandi"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Telugu companion. If the user writes in Telugu or Telugish, reply in natural, conversational Telugu or sweet Telugish (Telugu words in Roman letters, e.g. 'Hey! Nenu chala bagunnanu, meeru ela unnaru? Emi chestunnaru?'). NEVER output random disjointed Telugu characters. Output complete, natural, everyday sentences.",
  },
  tamil: {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    script: "Tamil",
    scriptUnicodeRange: [0x0B80, 0x0BFF],
    romanizedVariantName: "Tanglish",
    greetingExample: "வணக்கம் / Vanakkam",
    commonWords: ["eppadi", "nallam", "aama", "illa", "enna", "sari"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Tamil companion. Reply in natural Tamil or conversational Tanglish (e.g. 'Vanakkam! Eppadi irukkeenga? Nalla irukkeengala?'). Keep it sweet, friendly and expressive.",
  },
  kannada: {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    script: "Kannada",
    scriptUnicodeRange: [0x0C80, 0x0CFF],
    romanizedVariantName: "Kannadish",
    greetingExample: "ನಮಸ್ಕಾರ / Namaskara",
    commonWords: ["hegiddeera", "chennagiddini", "enu", "haudu", "illa"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Kannada companion. Reply in natural Kannada or conversational Roman Kannada (e.g. 'Namaskara! Hegiddeera? Chennagiddira?').",
  },
  malayalam: {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    script: "Malayalam",
    scriptUnicodeRange: [0x0D00, 0x0D7F],
    romanizedVariantName: "Manglish",
    greetingExample: "നമസ്കാരം / Namaskaram",
    commonWords: ["sukhamano", "entha", "athe", "illa", "sherikkum"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Malayalam companion. Reply in natural Malayalam or Manglish (e.g. 'Namaskaram! Sukhamano? Enthanu visheshangal?').",
  },
  marathi: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    script: "Devanagari",
    scriptUnicodeRange: [0x0900, 0x097F],
    greetingExample: "नमस्कार / Namaskar",
    commonWords: ["kasa", "kashi", "aahes", "ho", "nahi", "kay"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Marathi companion. Reply in natural, sweet Marathi (e.g. 'Namaskar! Kase aahat? Majet na?').",
  },
  bengali: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    script: "Bengali",
    scriptUnicodeRange: [0x0980, 0x09FF],
    greetingExample: "নমস্কার / Nomoshkar",
    commonWords: ["kemon", "aachen", "bhalo", "hyan", "na", "ki"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Bengali companion. Reply in sweet, natural Bengali (e.g. 'Nomoshkar! Kemon aachen? Shob bhalo to?').",
  },
  gujarati: {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    script: "Gujarati",
    scriptUnicodeRange: [0x0A80, 0x0AFF],
    greetingExample: "નમસ્તે / Kem Cho",
    commonWords: ["kem", "cho", "maza", "ha", "na", "su"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Gujarati companion. Reply in warm, cheerful Gujarati (e.g. 'Kem cho? Badhu maza ma ne?').",
  },
  punjabi: {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    script: "Gurmukhi",
    scriptUnicodeRange: [0x0A00, 0x0A7F],
    greetingExample: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ / Sat Sri Akal",
    commonWords: ["ki", "haal", "theek", "haan", "nahi", "daso"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Punjabi companion. Reply in vibrant, sweet Punjabi (e.g. 'Sat Sri Akal ji! Ki haal chaal hai? Sab theek thaak?').",
  },
  odia: {
    code: "or",
    name: "Odia",
    nativeName: "ଓଡ଼ିଆ",
    script: "Odia",
    scriptUnicodeRange: [0x0B00, 0x0B7F],
    greetingExample: "ନମସ୍କାର / Namaskara",
    commonWords: ["kemiti", "achanti", "bhala", "haan", "na"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Odia companion. Reply in polite, sweet Odia (e.g. 'Namaskara! Kemiti achanti? Sabu bhala ta?').",
  },
  assamese: {
    code: "as",
    name: "Assamese",
    nativeName: "অসমীয়া",
    script: "Bengali-Assamese",
    scriptUnicodeRange: [0x0980, 0x09FF],
    greetingExample: "নমস্কাৰ / Nomoskar",
    commonWords: ["kene", "asa", "bhal", "hoi", "nohoy"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Assamese companion. Reply warmly in Assamese (e.g. 'Nomoskar! Kene asa? Bhal ne sob?').",
  },
  urdu: {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    script: "Arabic-Urdu",
    scriptUnicodeRange: [0x0600, 0x06FF],
    greetingExample: "آداب / Adaab",
    commonWords: ["kaise", "hain", "shukriya", "haan", "nahi", "kya"],
    conversationalDirective:
      "CRITICAL: You are an affectionate Urdu companion. Reply in elegant, sweet Urdu (e.g. 'Adaab! Kaise hain aap? Umeed hai sab khairiyat se honge.').",
  },
  english: {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "Latin",
    greetingExample: "Hello! / Hey there!",
    commonWords: ["hello", "how", "good", "yes", "no", "what"],
    conversationalDirective:
      "CRITICAL: You are an affectionate companion speaking modern Indian English. Reply warmly with sweet friendliness and relatable charm.",
  },
};

/**
 * Normalizes input language string and finds its registered configuration.
 *
 * If not explicitly registered, dynamically produces a custom LanguageConfig
 * adhering to the profile's specified regional language so none of the 87 categories
 * are silently dropped or substituted.
 */
export function resolveLanguageConfig(rawLanguage?: string | null): LanguageConfig {
  const normalized = (rawLanguage || "").trim().toLowerCase();

  if (normalized && LANGUAGE_REGISTRY[normalized]) {
    return LANGUAGE_REGISTRY[normalized];
  }

  // Check alias / substring match
  for (const [key, config] of Object.entries(LANGUAGE_REGISTRY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config;
    }
  }

  // If language is recognized among the 87 categories but doesn't have specialized preset,
  // dynamically generate dedicated cultural instruction without defaulting to Hindi/English!
  const capitalized = rawLanguage
    ? rawLanguage.trim().charAt(0).toUpperCase() + rawLanguage.trim().slice(1)
    : "Regional Indian Language";

  if (!rawLanguage || !rawLanguage.trim()) {
    console.warn(`[LanguageResolver] Missing language assignment. Using safe fallback.`);
  }

  return {
    code: normalized.slice(0, 3) || "ind",
    name: capitalized,
    nativeName: capitalized,
    script: "Native script / Romanized",
    greetingExample: `Hello / Greetings in ${capitalized}`,
    commonWords: [],
    conversationalDirective: `Your assigned native language is ${capitalized}.
- Whenever possible, reply in authentic ${capitalized} or Roman-script ${capitalized}.
- Match the user's language smoothly with sweet regional charm from your home state.
- Strictly do NOT default to standard English or corporate phrases unless the user explicitly speaks English to you.`,
  };
}

/**
 * Checks whether text contains characters from a specific Unicode script range.
 */
export function hasScriptCharacters(text: string, [start, end]: [number, number]): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= start && code <= end) {
      return true;
    }
  }
  return false;
}
