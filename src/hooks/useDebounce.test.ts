import type { WindowWithWebkitAudio } from "@/types/supabase-helpers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
  useDeepMemo,
  useLazyRef,
  usePrevious,
  useIntersectionObserver,
  useIdleCallback,
} from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("debounces value updates", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "a", delay: 300 },
    });

    rerender({ value: "ab", delay: 300 });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("resets timer when value changes rapidly", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ value: "third" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("third");
  });

  it("respects custom delay", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 1, delay: 500 },
    });

    rerender({ value: 2, delay: 500 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces callback invocations", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));

    act(() => {
      result.current("a");
      result.current("b");
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });
});

describe("useThrottledCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls immediately when interval elapsed", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => {
      result.current(1);
    });
    expect(fn).toHaveBeenCalledWith(1);

    act(() => {
      vi.advanceTimersByTime(300);
      result.current(2);
    });
    expect(fn).toHaveBeenCalledWith(2);
  });

  it("schedules trailing call within interval", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => {
      result.current(1);
      result.current(2);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it("clears pending trailing timeout on repeated calls", () => {
    const fn = vi.fn();
    const clearSpy = vi.spyOn(global, "clearTimeout");
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe("useDeepMemo", () => {
  it("recomputes when deps change", () => {
    const factory = vi.fn(({ n }: { n: number }) => n * 2);
    const { result, rerender } = renderHook(
      ({ dep }) => useDeepMemo(() => factory({ n: dep }), [dep]),
      { initialProps: { dep: 1 } },
    );

    expect(result.current).toBe(2);
    expect(factory).toHaveBeenCalledTimes(1);

    rerender({ dep: 1 });
    expect(factory).toHaveBeenCalledTimes(1);

    rerender({ dep: 2 });
    expect(result.current).toBe(4);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe("useLazyRef", () => {
  it("runs factory only once", () => {
    const factory = vi.fn(() => ({ id: 1 }));
    const { result, rerender } = renderHook(() => useLazyRef(factory));

    expect(result.current.current).toEqual({ id: 1 });
    expect(factory).toHaveBeenCalledTimes(1);
    rerender();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe("usePrevious", () => {
  it("returns previous value after update", () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: "first" },
    });

    expect(result.current).toBeUndefined();
    rerender({ v: "second" });
    expect(result.current).toBe("first");
    rerender({ v: "third" });
    expect(result.current).toBe("second");
  });
});

describe("useIntersectionObserver", () => {
  it("returns ref callback and intersecting state", async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class MockIntersectionObserver {
      constructor(private cb: IntersectionObserverCallback) {}
      observe = (el: Element) => {
        observe(el);
        this.cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      };
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const { result } = renderHook(() => useIntersectionObserver());
    const [setRef] = result.current;
    const el = document.createElement("div");

    act(() => {
      setRef(el);
    });

    await waitFor(() => {
      expect(result.current[1]).toBe(true);
    });
    expect(observe).toHaveBeenCalledWith(el);
    vi.unstubAllGlobals();
  });

  it("respects custom observer options", async () => {
    const observe = vi.fn();
    class MockIntersectionObserver {
      constructor(
        _cb: IntersectionObserverCallback,
        public options?: IntersectionObserverInit,
      ) {}
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const { result } = renderHook(() =>
      useIntersectionObserver({ threshold: 0.5, rootMargin: "8px" }),
    );
    const [setRef] = result.current;
    act(() => {
      setRef(document.createElement("div"));
    });

    expect(observe).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("useIdleCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to setTimeout when requestIdleCallback missing", () => {
    const original = window.requestIdleCallback;
    (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback = undefined;

    const fn = vi.fn();
    renderHook(() => useIdleCallback(fn));

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalled();

    window.requestIdleCallback = original;
  });

  it("uses requestIdleCallback when available", () => {
    const idleFn = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    window.requestIdleCallback = idleFn;
    window.cancelIdleCallback = vi.fn();

    const fn = vi.fn();
    renderHook(() => useIdleCallback(fn, { timeout: 100 }));
    expect(idleFn).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});
