import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppBottomTabs, getMenTabs, getWomenTabs } from "./AppBottomTabs";

describe("getMenTabs", () => {
  it("returns expected tab ids with defaults", () => {
    const tabs = getMenTabs(2, 1, 0);
    const ids = tabs.map((t) => t.id);
    expect(ids).toContain("online");
    expect(ids).toContain("chats");
    expect(ids).toContain("groups");
    expect(ids).toContain("wallet");
    expect(ids).toContain("profile");
  });

  it("omits optional tabs when disabled", () => {
    const tabs = getMenTabs(undefined, undefined, undefined, false, false, false, false);
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("chats");
    expect(ids).not.toContain("groups");
    expect(ids).not.toContain("statement");
    expect(ids).not.toContain("history");
  });

  it("passes badge counts", () => {
    const tabs = getMenTabs(5, 3, 1);
    expect(tabs.find((t) => t.id === "online")?.badge).toBe(5);
    expect(tabs.find((t) => t.id === "chats")?.badge).toBe(3);
  });

  it("marks paid tabs with recharge badge when needsRecharge", () => {
    const tabs = getMenTabs(5, 3, 1, true, true, true, true, true);
    expect(tabs.find((t) => t.id === "chats")?.rechargeBadge).toBe(true);
    expect(tabs.find((t) => t.id === "chats")?.locked).toBe(true);
    expect(tabs.find((t) => t.id === "chats")?.badge).toBeUndefined();
    expect(tabs.find((t) => t.id === "groups")?.rechargeBadge).toBe(true);
    expect(tabs.find((t) => t.id === "history")?.rechargeBadge).toBe(true);
    expect(tabs.find((t) => t.id === "history")?.locked).toBe(true);
    expect(tabs.find((t) => t.id === "matches")?.rechargeBadge).toBe(true);
    expect(tabs.find((t) => t.id === "matches")?.locked).toBe(true);
    expect(tabs.find((t) => t.id === "matches")?.badge).toBeUndefined();
    expect(tabs.find((t) => t.id === "online")?.rechargeBadge).toBeFalsy();
    expect(tabs.find((t) => t.id === "wallet")?.rechargeBadge).toBeFalsy();
  });
});

describe("getWomenTabs", () => {
  it("returns women-specific tabs", () => {
    const tabs = getWomenTabs();
    const ids = tabs.map((t) => t.id);
    expect(ids).toContain("tl");
    expect(ids).toContain("community");
    expect(ids).toContain("score");
    expect(ids).toContain("history");
  });
});

describe("AppBottomTabs", () => {
  it("renders all tab labels", () => {
    const tabs = getMenTabs();
    render(<AppBottomTabs tabs={tabs} activeTab="online" onTabChange={vi.fn()} />);
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Wallet")).toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    const tabs = getMenTabs();
    render(<AppBottomTabs tabs={tabs} activeTab="online" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Wallet"));
    expect(onTabChange).toHaveBeenCalledWith("wallet");
  });

  it("shows badge overflow as 99+", () => {
    const tabs = [{ id: "online", label: "Online", icon: <span>icon</span>, badge: 120 }];
    render(<AppBottomTabs tabs={tabs} activeTab="online" onTabChange={vi.fn()} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows exact badge count under 100", () => {
    const tabs = [{ id: "online", label: "Online", icon: <span>icon</span>, badge: 7 }];
    render(<AppBottomTabs tabs={tabs} activeTab="other" onTabChange={vi.fn()} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("hides badge when zero or undefined", () => {
    const tabs = [
      { id: "a", label: "A", icon: <span>i</span>, badge: 0 },
      { id: "b", label: "B", icon: <span>i</span> },
    ];
    const { container } = render(<AppBottomTabs tabs={tabs} activeTab="a" onTabChange={vi.fn()} />);
    expect(container.querySelector(".bg-primary.text-primary-foreground")).toBeNull();
  });

  it("shows recharge badge instead of count badge", () => {
    const tabs = [
      {
        id: "chats",
        label: "Chats",
        icon: <span>i</span>,
        badge: 5,
        rechargeBadge: true,
      },
    ];
    render(<AppBottomTabs tabs={tabs} activeTab="online" onTabChange={vi.fn()} />);
    expect(screen.getByLabelText("Recharge required")).toHaveTextContent("₹");
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });
});
