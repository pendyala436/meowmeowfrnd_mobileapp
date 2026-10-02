/**
 * Canonical public site origin for SEO / OG / sitemap.
 * Override with VITE_SITE_URL at build time if the primary domain changes.
 */
export const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL || "https://www.meow-meow.co.in").replace(
  /\/$/,
  "",
);

export const SITE_NAME = "Meow Meow Frnd App";
export const SITE_TAGLINE = "Find Your Purrfect Match";
export const SITE_DEFAULT_TITLE = `${SITE_NAME} - ${SITE_TAGLINE}`;
export const SITE_DEFAULT_DESCRIPTION =
  "Meow Meow Frnd App is a global friend-making app connecting people through meaningful chat, audio, and video conversations. Find your perfect friend worldwide.";

/** Absolute URL helper */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_OG_IMAGE = absoluteUrl("/meow-meow-logo.png");
export const SITE_LOGO = absoluteUrl("/icons/icon-512x512.png");

export interface PageSeo {
  title: string;
  description: string;
}

/** Unique titles/descriptions for public + common app routes */
export const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/auth": {
    title: `Sign In | ${SITE_NAME}`,
    description:
      "Sign in to Meow Meow Frnd App to chat, call, and connect with verified friends across India and beyond.",
  },
  "/install": {
    title: `Install App | ${SITE_NAME}`,
    description:
      "Install Meow Meow Frnd as a PWA on Android, iPhone, or desktop for faster access, notifications, and an app-like experience.",
  },
  "/about": {
    title: `About Us | ${SITE_NAME}`,
    description:
      "Learn about Meow Meow Frnd App — a friend-making platform focused on safe chat, audio and video calls, and meaningful connections.",
  },
  "/how-it-works": {
    title: `How It Works | ${SITE_NAME}`,
    description:
      "See how Meow Meow Frnd works: register, verify, match by language, chat and call safely, and manage your wallet on web or mobile.",
  },
  "/faq": {
    title: `FAQ | ${SITE_NAME}`,
    description:
      "Frequently asked questions about Meow Meow Frnd App — accounts, safety, chat, calls, payments, languages, and installing the PWA.",
  },
  "/forgot-password": {
    title: `Forgot Password | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/register": {
    title: `Register | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/dashboard": {
    title: `Dashboard | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/women-dashboard": {
    title: `Dashboard | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/admin": {
    title: `Admin | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/settings": {
    title: `Settings | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  "/wallet": {
    title: `Wallet | ${SITE_NAME}`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
};

/**
 * Paths that search engines / AI crawlers may index.
 * Everything else gets noindex via SeoManager.
 */
export const PUBLIC_INDEXABLE_PATHS = new Set([
  "/",
  "/auth",
  "/install",
  "/about",
  "/how-it-works",
  "/faq",
]);

export function isPublicIndexablePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_INDEXABLE_PATHS.has(normalized);
}

export function getPageSeo(pathname: string): PageSeo {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (PAGE_SEO[normalized]) return PAGE_SEO[normalized];
  if (normalized.startsWith("/admin")) {
    return { title: `Admin | ${SITE_NAME}`, description: SITE_DEFAULT_DESCRIPTION };
  }
  if (normalized.startsWith("/chat")) {
    return { title: `Chat | ${SITE_NAME}`, description: SITE_DEFAULT_DESCRIPTION };
  }
  return { title: SITE_NAME, description: SITE_DEFAULT_DESCRIPTION };
}
