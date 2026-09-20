import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { navigateMock, useAuthReadyMock, fromMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useAuthReadyMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuthReady", () => ({
  useAuthReady: () => useAuthReadyMock(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import PrivateGroupsScreen from "./PrivateGroupsScreen";
import { ROUTES } from "@/constants";

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("PrivateGroupsScreen", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    fromMock.mockReset();
  });

  it("redirects unauthenticated users to home", async () => {
    useAuthReadyMock.mockReturnValue({ user: null, isReady: true });

    render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(ROUTES.HOME, { replace: true });
    });
  });

  it("redirects male users to dashboard groups tab", async () => {
    useAuthReadyMock.mockReturnValue({ user: { id: "male-1" }, isReady: true });

    fromMock
      .mockReturnValueOnce(chain({ data: { gender: "male" } }))
      .mockReturnValueOnce(chain({ data: null }));

    render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.DASHBOARD}?tab=groups`, {
        replace: true,
      });
    });
  });

  it("redirects female users to women dashboard groups tab", async () => {
    useAuthReadyMock.mockReturnValue({ user: { id: "female-1" }, isReady: true });

    fromMock
      .mockReturnValueOnce(chain({ data: { gender: "female" } }))
      .mockReturnValueOnce(chain({ data: null }));

    render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.WOMEN_DASHBOARD}?tab=groups`, {
        replace: true,
      });
    });
  });

  it("redirects admin users to /admin", async () => {
    useAuthReadyMock.mockReturnValue({ user: { id: "admin-1" }, isReady: true });

    fromMock
      .mockReturnValueOnce(chain({ data: { gender: "male" } }))
      .mockReturnValueOnce(chain({ data: { role: "admin" } }));

    render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/admin", { replace: true });
    });
  });

  it("shows loading spinner while auth is not ready", () => {
    useAuthReadyMock.mockReturnValue({ user: null, isReady: false });

    const { container } = render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects to dashboard groups tab when profile lookup fails", async () => {
    useAuthReadyMock.mockReturnValue({ user: { id: "user-1" }, isReady: true });
    fromMock.mockImplementation(() => {
      throw new Error("db unavailable");
    });

    render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.DASHBOARD}?tab=groups`, {
        replace: true,
      });
    });
  });

  it("does not navigate after unmount", async () => {
    useAuthReadyMock.mockReturnValue({ user: { id: "user-1" }, isReady: true });

    let resolveQuery!: (value: { data: { gender: string } }) => void;
    const pending = new Promise<{ data: { gender: string } }>((resolve) => {
      resolveQuery = resolve;
    });

    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue(pending),
    }));

    const { unmount } = render(
      <MemoryRouter>
        <PrivateGroupsScreen />
      </MemoryRouter>,
    );

    unmount();
    resolveQuery({ data: { gender: "male" } });

    await new Promise((r) => setTimeout(r, 30));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
