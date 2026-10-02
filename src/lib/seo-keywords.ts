/**
 * Curated SEO / AEO keyword package for Meow Meow Frnd.
 * Friendship-first phrasing; light “meet people / connections” language.
 * Full client keyword dumps belong in ads accounts — not here.
 */

/** Short meta keywords (sparse; Google largely ignores — keep brand + intents only) */
export const META_KEYWORDS = [
  "Meow Meow Frnd",
  "make friends online",
  "meet new people online",
  "friendship app",
  "chat with friends",
  "voice chat",
  "video chat",
  "safe online friends",
  "find like minded friends",
  "Indian language friends",
  "PWA social app",
].join(", ");

/** Topics for JSON-LD knowsAbout / AI entity signals */
export const KNOWS_ABOUT_TOPICS = [
  "online friendship",
  "make friends online",
  "meet new people online",
  "friendship community",
  "chat with new people",
  "private messaging",
  "voice chat",
  "video chat",
  "safe online connections",
  "meaningful friendships",
  "like minded people",
  "Indian language chat",
  "Progressive Web App",
] as const;

/**
 * High-intent phrases we intentionally target in FAQ / copy / llms.txt.
 * Keep under ~25 for quality.
 */
export const TARGET_SEARCH_INTENTS = [
  "how to make friends online",
  "how to meet new people online",
  "apps to make friends",
  "apps to meet people",
  "find friends online",
  "meet like minded people",
  "chat with new people",
  "voice chat with friends",
  "video chat with friends",
  "safe online friends",
  "how to safely meet people online",
  "meaningful friendships",
  "genuine connections online",
  "friendship chat app",
  "Meow Meow Frnd app",
  "MeowMeow friendship app",
  "MeowMeow chat app",
  "MeowMeow voice chat",
  "MeowMeow video chat",
  "how does online friendship work",
] as const;

export const HOME_TITLE = "Meow Meow Frnd App – Make Friends Online | Chat, Voice & Video";
export const HOME_DESCRIPTION =
  "Make friends online with Meow Meow Frnd App. Meet new people, chat privately, and connect with like-minded friends through safe text, voice, and video conversations.";
