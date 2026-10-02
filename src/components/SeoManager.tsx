/**
 * Route-aware SEO head updates for the SPA.
 * - Public routes: index,follow + canonical
 * - Private/app routes: noindex,nofollow (dashboards, chat, admin, registration)
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_NAME,
  SITE_OG_IMAGE,
  absoluteUrl,
  isPublicIndexablePath,
} from "@/lib/site";

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const ROUTE_TITLES: Record<string, string> = {
  "/": SITE_DEFAULT_TITLE,
  "/auth": `Sign In | ${SITE_NAME}`,
  "/install": `Install App | ${SITE_NAME}`,
  "/forgot-password": `Forgot Password | ${SITE_NAME}`,
  "/register": `Register | ${SITE_NAME}`,
  "/dashboard": `Dashboard | ${SITE_NAME}`,
  "/women-dashboard": `Dashboard | ${SITE_NAME}`,
  "/admin": `Admin | ${SITE_NAME}`,
  "/settings": `Settings | ${SITE_NAME}`,
  "/wallet": `Wallet | ${SITE_NAME}`,
};

export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalized = pathname.replace(/\/+$/, "") || "/";
    const indexable = isPublicIndexablePath(normalized);
    const canonical = absoluteUrl(normalized === "/" ? "/" : normalized);
    const title =
      ROUTE_TITLES[normalized] ||
      (normalized.startsWith("/admin")
        ? `Admin | ${SITE_NAME}`
        : normalized.startsWith("/chat")
          ? `Chat | ${SITE_NAME}`
          : `${SITE_NAME}`);

    document.title = title;

    upsertMeta("name", "description", SITE_DEFAULT_DESCRIPTION);
    upsertMeta(
      "name",
      "robots",
      indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    );
    upsertMeta("name", "googlebot", indexable ? "index, follow" : "noindex, nofollow");

    upsertLink("canonical", canonical);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", SITE_DEFAULT_DESCRIPTION);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", SITE_OG_IMAGE);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "en_IN");

    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", SITE_DEFAULT_DESCRIPTION);
    upsertMeta("name", "twitter:image", SITE_OG_IMAGE);
    upsertMeta("name", "twitter:card", "summary_large_image");
  }, [pathname]);

  return null;
}

export default SeoManager;
