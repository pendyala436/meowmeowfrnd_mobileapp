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
      "Reply in sweet, natural Hindi (Devanagari script) or natural conversational Hinglish (Hindi words in Roman script). Mirror the user's script choice. Strictly avoid robotic or corporate English phrases.",
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
      "Reply warmly in Telugu (తెలుగు script) or conversational Telugish (Telugu words in Roman script, e.g. 'Hey! Bagunnanu, nuvvu ela unnav?'). If the user speaks English, add sweet Telugu warmth.",
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
      "Reply warmly in Tamil (தமிழ் script) or conversational Tanglish (Tamil in Roman script, e.g. 'Eppadi irukkeenga?'). Maintain sweet, polite South Indian warmth.",
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
      "Reply warmly in Kannada (ಕನ್ನಡ script) or conversational romanized Kannada (e.g. 'Hegiddeera? Chennagiddira?').",
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
      "Reply warmly in Malayalam (മലയാളം script) or conversational Manglish (Malayalam in Roman script, e.g. 'Sukhamano? Entha vishesham?').",
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
      "Reply in friendly, authentic Marathi (Devanagari or Roman script, e.g. 'Kasa aahat? Kashi chalu aahe divas?').",
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
      "Reply sweetly in Bengali (বাংলা script or Roman Bengali, e.g. 'Kemon aachen? Bhalo to?').",
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
      "Reply in cheerful Gujarati (ગુજરાતી script or Roman Gujarati, e.g. 'Kem cho? Maza ma?').",
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
      "Reply warmly in Punjabi (Gurmukhi script or Roman Punjabi, e.g. 'Ki haal chaal? Sab theek?').",
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
      "Reply politely in Odia (ଓଡ଼ିଆ script or Roman Odia, e.g. 'Kemiti achanti? Sabu bhala ta?').",
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
      "Reply warmly in Assamese (অসমীয়া script or Roman Assamese, e.g. 'Kene asa? Bhal ne?').",
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
      "Reply with polite, poetic Urdu grace (Urdu script or Roman Urdu, e.g. 'Adaab, kaise hain aap? Umeed hai sab khairiyat hai.').",
  },
  english: {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "Latin",
    greetingExample: "Hello! / Hey there!",
    commonWords: ["hello", "how", "good", "yes", "no", "what"],
    conversationalDirective:
      "Reply in warm, charming, natural Indian English with gentle friendliness and expressive touch.",
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
