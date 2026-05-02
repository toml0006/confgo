import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Kicker } from "./kicker";

describe("Kicker", () => {
  it("renders children", () => {
    render(<Kicker>Section</Kicker>);
    expect(screen.getByText("Section")).toBeInTheDocument();
  });

  it("uses data-slot=kicker and default classes", () => {
    render(<Kicker>Hello</Kicker>);
    const el = screen.getByText("Hello");
    expect(el).toHaveAttribute("data-slot", "kicker");
    expect(el).toHaveClass("font-ui");
    expect(el).toHaveClass("uppercase");
    expect(el).toHaveClass("tracking-[0.22em]");
    expect(el).toHaveClass("text-ink2");
  });

  it("swaps to brand color when accent prop is true", () => {
    render(<Kicker accent>Hello</Kicker>);
    const el = screen.getByText("Hello");
    expect(el).toHaveClass("text-brand");
    expect(el).not.toHaveClass("text-ink2");
  });

  it("merges custom className", () => {
    render(<Kicker className="mt-4">Hello</Kicker>);
    expect(screen.getByText("Hello")).toHaveClass("mt-4");
  });

  it("forwards extra div props", () => {
    render(<Kicker id="k1" data-testid="kk">Hello</Kicker>);
    const el = screen.getByTestId("kk");
    expect(el).toHaveAttribute("id", "k1");
  });
});
