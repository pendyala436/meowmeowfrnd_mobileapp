/**
 * IndexNow — notify Bing/Yandex (and compatible engines) of URL updates.
 * Key file must be hosted at: {SITE_ORIGIN}/{INDEXNOW_KEY}.txt
 * @see https://www.indexnow.org/documentation
 */
import { SITE_ORIGIN, absoluteUrl } from "@/lib/site";

export const INDEXNOW_KEY = "1f6b2c55d15941fb8791312d77d3f0d8";

export const INDEXNOW_KEY_LOCATION = absoluteUrl(`/${INDEXNOW_KEY}.txt`);

/** Default public URLs to push after deploy */
export const INDEXNOW_DEFAULT_URLS = [
  absoluteUrl("/"),
  absoluteUrl("/auth"),
  absoluteUrl("/install"),
  absoluteUrl("/about"),
  absoluteUrl("/how-it-works"),
  absoluteUrl("/faq"),
];

export interface IndexNowResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Submit one or more absolute URLs to the IndexNow endpoint.
 * Safe to call from Node scripts or the browser (CORS may block browser calls —
 * prefer the post-deploy script for production).
 */
export async function submitIndexNow(
  urls: string[] = INDEXNOW_DEFAULT_URLS,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const host = new URL(SITE_ORIGIN).host;
  const unique = Array.from(
    new Set(
      urls
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => (u.startsWith("http") ? u : absoluteUrl(u))),
    ),
  );

  if (unique.length === 0) {
    return { ok: false, status: 0, message: "No URLs to submit" };
  }

  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: unique,
  };

  try {
    const res = await fetchImpl("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });

    // 200 / 202 = accepted; 422 often means already submitted recently
    if (res.status === 200 || res.status === 202 || res.status === 422) {
      return {
        ok: true,
        status: res.status,
        message:
          res.status === 422
            ? "IndexNow accepted (URL was submitted recently)"
            : `IndexNow accepted (${unique.length} URL(s))`,
      };
    }

    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: text || `IndexNow HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : "IndexNow request failed",
    };
  }
}
