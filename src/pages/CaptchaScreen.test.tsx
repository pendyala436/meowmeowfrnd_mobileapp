import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { navigateMock, getSessionMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/AuroraBackground", () => ({
  default: () => <div data-testid="aurora" />,
}));

vi.mock("@/components/MeowLogo", () => ({
  default: () => <div data-testid="logo" />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import CaptchaScreen, { generateChallenge } from "./CaptchaScreen";
import { clearCaptchaPassCache } from "@/components/ProtectedRoute";

function solveFromDom() {
  const challengeEl = screen.getByText(/\d+ [+\-] \d+ = \?/);
  const match = challengeEl.textContent!.match(/(\d+)\s([+\-])\s(\d+)/)!;
  return match[2] === "+"
    ? Number(match[1]) + Number(match[3])
    : Number(match[1]) - Number(match[3]);
}

describe("generateChallenge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds addition challenges", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const c = generateChallenge();
    expect(c.op).toBe("+");
    expect(c.answer).toBe(c.a + c.b);
  });

  it("builds subtraction challenges with non-negative results", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9);
    const c = generateChallenge();
    expect(c.op).toBe("-");
    expect(c.a).toBeGreaterThanOrEqual(c.b);
    expect(c.answer).toBe(c.a - c.b);
  });
});

describe("CaptchaScreen", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getSessionMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    clearCaptchaPassCache();
  });

  it("redirects home when postCaptchaRedirect is missing", async () => {
    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("renders math challenge when redirect target is set", () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Quick Security Check/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+ [+\-] \d+ = \?/)).toBeInTheDocument();
  });

  it("shows error for empty answer", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    expect(await screen.findByText(/please enter your answer/i)).toBeInTheDocument();
  });

  it("shows error for non-integer answer", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    expect(await screen.findByText(/valid number/i)).toBeInTheDocument();
  });

  it("clears error when user types again", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await screen.findByText(/please enter your answer/i);

    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: "2" } });
    expect(screen.queryByText(/please enter your answer/i)).not.toBeInTheDocument();
  });

  it("navigates on correct answer and marks captcha verified", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard?tab=groups");
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-99" } } } });

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard?tab=groups", { replace: true });
    });
    expect(localStorage.getItem("captchaVerifiedFor:user-99")).toBeTruthy();
    expect(sessionStorage.getItem("postCaptchaRedirect")).toBeNull();
  });

  it("falls back to sessionStorage when no auth user", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    getSessionMock.mockResolvedValue({ data: { session: null } });

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem("captchaVerifiedAt")).toBeTruthy();
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("falls back to sessionStorage when getSession throws", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    getSessionMock.mockRejectedValue(new Error("auth down"));

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem("captchaVerifiedAt")).toBeTruthy();
    });
  });

  it("uses default dashboard when redirect key missing at verify time", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    sessionStorage.removeItem("postCaptchaRedirect");
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("tracks failed attempts and refreshes challenge", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: String(solveFromDom() + 100) },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    expect(await screen.findByText(/4 attempts remaining/i)).toBeInTheDocument();
  });

  it("redirects home after max failed attempts", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByLabelText(/your answer/i), {
        target: { value: String(solveFromDom() + 100 + i) },
      });
      fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
      if (i < 4) {
        await screen.findByText(new RegExp(`${4 - i} attempts remaining`));
      }
    }

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(sessionStorage.getItem("postCaptchaRedirect")).toBeNull();
  });

  it("submits on Enter key", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u2" } } } });

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    const input = screen.getByLabelText(/your answer/i);
    fireEvent.change(input, { target: { value: String(answer) } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("refreshes challenge via button", () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const before = screen.getByText(/\d+ [+\-] \d+ = \?/).textContent;
    fireEvent.click(screen.getByLabelText(/refresh challenge/i));
    expect(screen.getByText(/\d+ [+\-] \d+ = \?/).textContent).toBeTruthy();
    expect(screen.getByLabelText(/your answer/i)).toHaveValue(null);
    expect(before).toBeTruthy();
  });

  it("shows verifying state while session resolves", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    let resolveSession!: (v: unknown) => void;
    getSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    expect(await screen.findByText(/verifying/i)).toBeInTheDocument();

    await act(async () => {
      resolveSession({ data: { session: { user: { id: "u3" } } } });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("blocks verify while already verifying via early return", async () => {
    sessionStorage.setItem("postCaptchaRedirect", "/dashboard");
    getSessionMock.mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <MemoryRouter>
        <CaptchaScreen />
      </MemoryRouter>,
    );

    const answer = solveFromDom();
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: String(answer) } });
    const btn = screen.getByRole("button", { name: /verify & continue/i });

    fireEvent.click(btn);
    await screen.findByText(/verifying/i);
    fireEvent.keyDown(screen.getByLabelText(/your answer/i), { key: "Enter" });

    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });
});
