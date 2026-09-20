import { describe, it, expect } from "vitest";
import {
  derivePresence,
  formatLastSeen,
  isVisibilityStatusChange,
  PRESENCE_LABEL,
  type UserStatusRow,
} from "./presence";

const baseRow = (overrides: Partial<UserStatusRow> = {}): UserStatusRow => ({
  user_id: "u1",
  is_online: true,
  last_seen: new Date().toISOString(),
  status: "available",
  ...overrides,
});

describe("derivePresence", () => {
  const now = Date.parse("2026-09-01T12:00:00");

  it("returns offline for null row", () => {
    expect(derivePresence(null)).toEqual({ status: "offline", lastSeen: null });
  });

  it("handles row without last_seen timestamp", () => {
    const row = baseRow({ last_seen: null as unknown as string, is_online: true });
    expect(derivePresence(row, { now }).status).toBe("offline");
    expect(derivePresence(row, { now }).lastSeen).toBeNull();
  });

  it("returns typing when isTyping option is set", () => {
    const row = baseRow({ last_seen: new Date(now - 30_000).toISOString() });
    expect(derivePresence(row, { isTyping: true, now }).status).toBe("typing");
  });

  it("returns in_call when active_call_count > 0", () => {
    const row = baseRow({ active_call_count: 1, last_seen: new Date(now - 30_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("in_call");
  });

  it("returns busy when status is busy", () => {
    const row = baseRow({ status: "busy", last_seen: new Date(now - 30_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("busy");
  });

  it("returns offline when not online or stale", () => {
    const stale = baseRow({
      is_online: false,
      last_seen: new Date(now - 11 * 60_000).toISOString(),
    });
    expect(derivePresence(stale, { now }).status).toBe("offline");

    const expired = baseRow({
      is_online: true,
      last_seen: new Date(now - 11 * 60_000).toISOString(),
    });
    expect(derivePresence(expired, { now }).status).toBe("offline");
  });

  it("returns online within 60s window", () => {
    const row = baseRow({ last_seen: new Date(now - 30_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("online");
  });

  it("returns active within 2m window", () => {
    const row = baseRow({ last_seen: new Date(now - 90_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("active");
  });

  it("returns online between 2m and 5m", () => {
    const row = baseRow({ last_seen: new Date(now - 3 * 60_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("online");
  });

  it("returns away after 5m but before stale cutoff", () => {
    const row = baseRow({ last_seen: new Date(now - 6 * 60_000).toISOString() });
    expect(derivePresence(row, { now }).status).toBe("away");
  });
});

describe("PRESENCE_LABEL", () => {
  it("has a label for every status", () => {
    expect(PRESENCE_LABEL.online).toBe("Online");
    expect(PRESENCE_LABEL.offline).toBe("Offline");
    expect(PRESENCE_LABEL.typing).toBe("Typing…");
  });
});

describe("formatLastSeen", () => {
  const now = Date.parse("2026-09-01T14:00:00");

  it('returns "Offline" for null', () => {
    expect(formatLastSeen(null, now)).toBe("Offline");
  });

  it("returns just now for recent activity", () => {
    const d = new Date(now - 30_000);
    expect(formatLastSeen(d, now)).toBe("Last seen just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(now - 5 * 60_000);
    expect(formatLastSeen(d, now)).toBe("Last seen 5 mins ago");
  });

  it("returns singular minute", () => {
    const d = new Date(now - 60_000);
    expect(formatLastSeen(d, now)).toBe("Last seen 1 min ago");
  });

  it("returns today at time", () => {
    const d = new Date(now - 2 * 60 * 60_000);
    const result = formatLastSeen(d, now);
    expect(result).toMatch(/^Last seen today at /);
  });

  it("returns yesterday at time", () => {
    const d = new Date(now - 24 * 60 * 60_000);
    const result = formatLastSeen(d, now);
    expect(result).toMatch(/^Last seen yesterday at /);
  });

  it("returns full date for older timestamps", () => {
    const d = new Date("2026-08-01T10:00:00");
    const result = formatLastSeen(d, now);
    expect(result).toMatch(/^Last seen .* at /);
  });
});

describe("isVisibilityStatusChange", () => {
  it("returns true when user_id is missing", () => {
    expect(isVisibilityStatusChange({ eventType: "UPDATE", new: {} }, new Map())).toBe(true);
  });

  it("returns true on DELETE and removes snapshot entry", () => {
    const snapshot = new Map([["u1", "1:Available"]]);
    const result = isVisibilityStatusChange(
      { eventType: "DELETE", old: { user_id: "u1" } },
      snapshot,
    );
    expect(result).toBe(true);
    expect(snapshot.has("u1")).toBe(false);
  });

  it("returns false when visibility key unchanged", () => {
    const snapshot = new Map<string, string>();
    const payload = {
      eventType: "UPDATE",
      new: { user_id: "u1", is_online: true, status_text: "Hi" },
    };
    expect(isVisibilityStatusChange(payload, snapshot)).toBe(true);
    expect(isVisibilityStatusChange(payload, snapshot)).toBe(false);
  });

  it("returns true when is_online changes", () => {
    const snapshot = new Map<string, string>();
    isVisibilityStatusChange(
      { eventType: "UPDATE", new: { user_id: "u1", is_online: true, status_text: "" } },
      snapshot,
    );
    expect(
      isVisibilityStatusChange(
        { eventType: "UPDATE", new: { user_id: "u1", is_online: false, status_text: "" } },
        snapshot,
      ),
    ).toBe(true);
  });

  it("returns true when status_text changes", () => {
    const snapshot = new Map<string, string>();
    isVisibilityStatusChange(
      { eventType: "UPDATE", new: { user_id: "u1", is_online: true, status_text: "A" } },
      snapshot,
    );
    expect(
      isVisibilityStatusChange(
        { eventType: "UPDATE", new: { user_id: "u1", is_online: true, status_text: "B" } },
        snapshot,
      ),
    ).toBe(true);
  });

  it("treats missing status_text as empty string", () => {
    const snapshot = new Map<string, string>();
    expect(
      isVisibilityStatusChange(
        { eventType: "UPDATE", new: { user_id: "u1", is_online: true } },
        snapshot,
      ),
    ).toBe(true);
  });

  it("returns true when last_seen crosses into the fresh window", () => {
    const snapshot = new Map<string, string>();
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();
    isVisibilityStatusChange(
      {
        eventType: "UPDATE",
        new: { user_id: "u1", is_online: true, status_text: "", last_seen: stale },
      },
      snapshot,
    );
    expect(
      isVisibilityStatusChange(
        {
          eventType: "UPDATE",
          new: { user_id: "u1", is_online: true, status_text: "", last_seen: fresh },
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("ignores heartbeats that stay inside the fresh window", () => {
    const snapshot = new Map<string, string>();
    const t1 = new Date(Date.now() - 30_000).toISOString();
    const t2 = new Date().toISOString();
    const first = {
      eventType: "UPDATE",
      new: { user_id: "u1", is_online: true, status_text: "", last_seen: t1 },
    };
    expect(isVisibilityStatusChange(first, snapshot)).toBe(true);
    expect(
      isVisibilityStatusChange(
        {
          eventType: "UPDATE",
          new: { user_id: "u1", is_online: true, status_text: "", last_seen: t2 },
        },
        snapshot,
      ),
    ).toBe(false);
  });
});
