import { describe, it, expect, vi, afterEach } from "vitest";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_DEFAULT_URLS,
  submitIndexNow,
} from "./indexnow";
import { SITE_ORIGIN } from "./site";

describe("indexnow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes key and keyLocation matching site origin", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    expect(INDEXNOW_KEY_LOCATION).toBe(`${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_DEFAULT_URLS.length).toBeGreaterThanOrEqual(6);
    expect(INDEXNOW_DEFAULT_URLS).toContain(`${SITE_ORIGIN}/about`);
    expect(INDEXNOW_DEFAULT_URLS).toContain(`${SITE_ORIGIN}/faq`);
  });

  it("returns early when url list is empty", async () => {
    const result = await submitIndexNow([]);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no urls/i);
  });

  it("accepts 200/202 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 202,
      text: async () => "",
    });
    const result = await submitIndexNow(["/about"], fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.key).toBe(INDEXNOW_KEY);
    expect(body.urlList).toEqual([`${SITE_ORIGIN}/about`]);
  });

  it("treats 422 as ok (recently submitted)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 422,
      text: async () => "already",
    });
    const result = await submitIndexNow(
      [`${SITE_ORIGIN}/faq`],
      fetchMock as unknown as typeof fetch,
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(422);
  });

  it("surfaces non-success HTTP errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 403,
      text: async () => "forbidden",
    });
    const result = await submitIndexNow(["/"], fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.message).toContain("forbidden");
  });

  it("uses status fallback when error body is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      text: async () => "",
    });
    const result = await submitIndexNow(["/"], fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("IndexNow HTTP 500");
  });

  it("handles network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await submitIndexNow(["/"], fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("offline");
  });

  it("handles non-Error thrown values", async () => {
    const fetchMock = vi.fn().mockRejectedValue("boom");
    const result = await submitIndexNow(["/"], fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("IndexNow request failed");
  });

  it("accepts 200 success path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "",
    });
    const result = await submitIndexNow(undefined, fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toMatch(/accepted/i);
  });
});
