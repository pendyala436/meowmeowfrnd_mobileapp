/**
 * Route-aware SEO head updates for the SPA.
 * - Public routes: index,follow + canonical + unique title/description
 * - Private/app routes: noindex,nofollow
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  SITE_NAME,
  SITE_OG_IMAGE,
  absoluteUrl,
  getPageSeo,
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

export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalized = pathname.replace(/\/+$/, "") || "/";
    const indexable = isPublicIndexablePath(normalized);
    const canonical = absoluteUrl(normalized === "/" ? "/" : normalized);
    const { title, description } = getPageSeo(normalized);

    document.title = title;

    upsertMeta("name", "description", description);
    upsertMeta(
      "name",
      "robots",
      indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    );
    upsertMeta("name", "googlebot", indexable ? "index, follow" : "noindex, nofollow");

    upsertLink("canonical", canonical);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", SITE_OG_IMAGE);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "en_IN");

    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", SITE_OG_IMAGE);
    upsertMeta("name", "twitter:card", "summary_large_image");
  }, [pathname]);

  return null;
}

export default SeoManager;
