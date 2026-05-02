import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { VennChart } from "./venn-chart";

describe("VennChart", () => {
  it("renders an svg with data-slot=venn-chart", () => {
    const { container } = render(
      <VennChart leftCount={1} rightCount={2} sharedCount={3} />,
    );
    const svg = container.querySelector('svg[data-slot="venn-chart"]');
    expect(svg).not.toBeNull();
  });

  it("renders 3 circles total (2 visible + 1 inside clipPath)", () => {
    const { container } = render(
      <VennChart leftCount={1} rightCount={2} sharedCount={3} />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(3);
  });

  it("renders 3 numerals matching the provided counts", () => {
    const { container } = render(
      <VennChart leftCount={7} rightCount={11} sharedCount={4} />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toContain("7");
    expect(texts).toContain("11");
    expect(texts).toContain("4");
  });

  it("renders an uppercase label when leftLabel='You' is provided", () => {
    const { container } = render(
      <VennChart
        leftCount={1}
        rightCount={2}
        sharedCount={3}
        leftLabel="You"
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toContain("YOU");
  });

  it("does not render label text node when leftLabel is omitted", () => {
    const { container } = render(
      <VennChart leftCount={1} rightCount={2} sharedCount={3} />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent ?? "",
    );
    // The only text nodes should be the three numerals
    expect(texts).toHaveLength(3);
    // No uppercase-only-letters label
    const hasLetters = texts.some((t) => /[A-Z]/.test(t));
    expect(hasLetters).toBe(false);
  });

  it("renders rightLabel when provided", () => {
    const { container } = render(
      <VennChart
        leftCount={1}
        rightCount={2}
        sharedCount={3}
        rightLabel="Them"
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toContain("THEM");
  });

  it("uses unique clipPath ids across two simultaneously-mounted charts", () => {
    const { container } = render(
      <div>
        <VennChart leftCount={1} rightCount={1} sharedCount={1} />
        <VennChart leftCount={2} rightCount={2} sharedCount={2} />
      </div>,
    );
    const clipPaths = container.querySelectorAll("clipPath");
    expect(clipPaths.length).toBe(2);
    const ids = Array.from(clipPaths).map((c) => c.getAttribute("id"));
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("applies provided leftFill and rightFill to circles", () => {
    const { container } = render(
      <VennChart
        leftCount={1}
        rightCount={2}
        sharedCount={3}
        leftFill="#ff0000"
        rightFill="#00ff00"
      />,
    );
    const circles = Array.from(container.querySelectorAll("circle"));
    const fills = circles.map((c) => c.getAttribute("fill"));
    expect(fills).toContain("#ff0000");
    expect(fills).toContain("#00ff00");
    // The clipped right-circle re-render uses rightFill too -> two greens
    expect(fills.filter((f) => f === "#00ff00").length).toBe(2);
  });
});
