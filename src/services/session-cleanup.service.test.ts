import { describe, it, expect, vi, beforeEach } from "vitest";

const chain = (awaitResult: { error: unknown } | "reject" = { error: null }) => {
  const q: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise<unknown>;
  } = {};
  q.update = vi.fn().mockReturnValue(q);
  q.delete = vi.fn().mockReturnValue(q);
  q.upsert = vi.fn().mockReturnValue(q);
  q.or = vi.fn().mockReturnValue(q);
  q.eq = vi.fn().mockReturnValue(q);
  q.in = vi.fn().mockReturnValue(q);
  if (awaitResult === "reject") {
    q.then = (_res, rej) => Promise.reject(new Error("db down")).then(undefined, rej);
  } else {
    q.then = (res) => Promise.resolve(awaitResult).then(res);
  }
  return q;
};

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { cleanupAllUserSessions } from "./session-cleanup.service";

describe("session-cleanup.service", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockImplementation(() => chain());
  });

  it("skips when userId is empty", async () => {
    await cleanupAllUserSessions("");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("runs cleanup queries for valid userId", async () => {
    await cleanupAllUserSessions("user-123");
    expect(fromMock).toHaveBeenCalled();
    expect(fromMock.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("continues when a cleanup query throws", async () => {
    fromMock.mockImplementation(() => chain("reject"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(cleanupAllUserSessions("user-123")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("warns when update returns error", async () => {
    fromMock.mockImplementation(() => chain({ error: { message: "fail" } }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await cleanupAllUserSessions("user-123");
    expect(warnSpy).toHaveBeenCalled();
  });
});
