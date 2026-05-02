import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme";

const STORAGE_KEY = "vb.theme.v1";

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useTheme>) => void }) {
  const api = useTheme();
  onReady(api);
  return null;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-mode");
    document.documentElement.style.colorScheme = "";
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("applies default light mode to <html>", () => {
    render(<ThemeProvider><Probe onReady={() => {}} /></ThemeProvider>);
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("setMode flips data-mode and persists", () => {
    let api!: ReturnType<typeof useTheme>;
    render(
      <ThemeProvider>
        <Probe onReady={(a) => (api = a)} />
      </ThemeProvider>,
    );
    act(() => api.setMode("dark"));
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}").mode).toBe("dark");
  });

  it("hydrates from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "dark" }));
    render(<ThemeProvider><Probe onReady={() => {}} /></ThemeProvider>);
    expect(document.documentElement.dataset.mode).toBe("dark");
  });

  it("rejects invalid stored values and falls back to defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "neon" }));
    render(<ThemeProvider><Probe onReady={() => {}} /></ThemeProvider>);
    expect(document.documentElement.dataset.mode).toBe("light");
  });
});
