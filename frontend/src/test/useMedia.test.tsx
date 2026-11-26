import { act, renderHook } from "@testing-library/react";
import { useMedia } from "@/lib/useMedia";

function mockMatchMedia(initial: boolean) {
  let handler: (() => void) | null = null;
  const mq = { matches: initial, addEventListener: (_: string, f: () => void) => { handler = f; }, removeEventListener: () => { handler = null; } };
  vi.stubGlobal("matchMedia", vi.fn(() => mq));
  return { set: (v: boolean) => { mq.matches = v; handler?.(); } };
}

describe("useMedia", () => {
  it("reports the initial match and reacts to changes", () => {
    const m = mockMatchMedia(true);
    const { result } = renderHook(() => useMedia("(max-width: 1279px)"));
    expect(result.current).toBe(true);
    act(() => m.set(false));
    expect(result.current).toBe(false);
  });
  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMedia("(max-width: 10px)"));
    expect(result.current).toBe(false);
  });
});
