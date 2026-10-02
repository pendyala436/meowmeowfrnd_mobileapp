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

/**
 * Paths that search engines / AI crawlers may index.
 * Everything else gets noindex via SeoManager.
 */
export const PUBLIC_INDEXABLE_PATHS = new Set(["/", "/auth", "/install"]);

export function isPublicIndexablePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_INDEXABLE_PATHS.has(normalized);
}
