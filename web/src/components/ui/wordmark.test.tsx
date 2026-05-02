import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders two overlapping circles in the SVG", () => {
    const { container } = render(<Wordmark />);
    const circles = container.querySelectorAll("svg circle");
    expect(circles).toHaveLength(2);
  });

  it("has data-slot=wordmark", () => {
    render(<Wordmark />);
    expect(screen.getByTestId("wordmark-root")).toHaveAttribute(
      "data-slot",
      "wordmark",
    );
  });

  it("renders a div by default", () => {
    render(<Wordmark />);
    const el = screen.getByTestId("wordmark-root");
    expect(el.tagName).toBe("DIV");
  });

  it("renders a button when onClick is passed", () => {
    const onClick = vi.fn();
    render(<Wordmark onClick={onClick} />);
    const el = screen.getByTestId("wordmark-root");
    expect(el.tagName).toBe("BUTTON");
  });

  it("renders the Venn·bar text with brand-colored dot", () => {
    const { container } = render(<Wordmark />);
    expect(container.textContent).toContain("Venn");
    expect(container.textContent).toContain("bar");
    // dot span should carry text-brand
    const dot = container.querySelector(".text-brand");
    expect(dot).not.toBeNull();
    expect(dot?.textContent).toBe("·");
  });

  it("uses ink2 stroke for the first circle when dim", () => {
    const { container } = render(<Wordmark dim />);
    const firstCircle = container.querySelector("svg circle");
    expect(firstCircle?.getAttribute("stroke")).toBe("var(--ink2)");
  });

  it("uses ink stroke for the first circle when not dim", () => {
    const { container } = render(<Wordmark />);
    const firstCircle = container.querySelector("svg circle");
    expect(firstCircle?.getAttribute("stroke")).toBe("var(--ink)");
  });
});
