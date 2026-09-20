import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PrivateGroupCallWindow } from "./PrivateGroupCallWindow";

const usePrivateGroupCallMock = vi.fn();

vi.mock("@/hooks/usePrivateGroupCall", () => ({
  MAX_PARTICIPANTS: 100,
  usePrivateGroupCall: (...args: unknown[]) => usePrivateGroupCallMock(...args),
}));

vi.mock("@/hooks/useSessionPriority", () => ({
  registerSession: vi.fn(),
  unregisterSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
  return {
    supabase: {
      from: vi.fn(() => chain()),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const baseGroup = {
  id: "group-1",
  name: "Rose Room",
  participant_count: 2,
  is_live: true,
  stream_id: "stream-1",
  access_type: "video",
  min_gift_amount: 0,
  owner_id: "host-1",
  owner_language: "en",
};

const baseHookReturn = {
  isConnecting: false,
  isConnected: true,
  isLive: false,
  participants: [
    { id: "host-1", name: "Host", isOwner: true, photo: null },
    { id: "man-1", name: "Viewer", isOwner: false, photo: null },
  ],
  viewerCount: 2,
  error: null,
  remainingTime: null,
  totalEarnings: 0,
  isRefunding: false,
  localVideoRef: { current: null },
  remoteVideoRef: { current: document.createElement("video") },
  hostStream: null,
  hostStatus: "live" as const,
  goLive: vi.fn(),
  joinStream: vi.fn(),
  endStream: vi.fn(),
  toggleVideo: vi.fn(),
  toggleAudio: vi.fn(),
  enableParticipantMic: vi.fn(),
  cleanup: vi.fn(),
};

describe("PrivateGroupCallWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePrivateGroupCallMock.mockReturnValue(baseHookReturn);
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows LIVE badge when connected even if isLive is false (men join path)", () => {
    render(
      <PrivateGroupCallWindow
        group={baseGroup}
        currentUserId="man-1"
        hostUserId="host-1"
        userName="Viewer"
        userPhoto={null}
        onClose={vi.fn()}
        isOwner={false}
      />,
    );

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows spent timer for non-owner participants during active session", async () => {
    render(
      <PrivateGroupCallWindow
        group={baseGroup}
        currentUserId="man-1"
        hostUserId="host-1"
        userName="Viewer"
        userPhoto={null}
        onClose={vi.fn()}
        isOwner={false}
      />,
    );

    expect(screen.getByText(/Spent ₹/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/Spent ₹/)).toBeInTheDocument();
  });

  it("shows not billing for host with no men connected", () => {
    usePrivateGroupCallMock.mockReturnValue({
      ...baseHookReturn,
      isLive: true,
      isConnected: true,
      participants: [{ id: "host-1", name: "Host", isOwner: true, photo: null }],
    });

    render(
      <PrivateGroupCallWindow
        group={baseGroup}
        currentUserId="host-1"
        userName="Host"
        userPhoto={null}
        onClose={vi.fn()}
        isOwner={true}
      />,
    );

    expect(screen.getByText(/Not billing/i)).toBeInTheDocument();
  });

  it("hides LIVE badge when neither connected nor live", () => {
    usePrivateGroupCallMock.mockReturnValue({
      ...baseHookReturn,
      isConnected: false,
      isLive: false,
    });

    render(
      <PrivateGroupCallWindow
        group={baseGroup}
        currentUserId="man-1"
        userName="Viewer"
        userPhoto={null}
        onClose={vi.fn()}
        isOwner={false}
      />,
    );

    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText(/Spent ₹/)).not.toBeInTheDocument();
  });
});
