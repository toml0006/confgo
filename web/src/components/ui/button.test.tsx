import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button atlas variants", () => {
  it("atlas-primary applies expected classes", () => {
    render(<Button variant="atlas-primary">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("rounded-full");
    expect(el).toHaveClass("bg-ink");
    expect(el).toHaveClass("text-bg");
    expect(el).toHaveClass("border-ink");
    expect(el).toHaveAttribute("data-variant", "atlas-primary");
  });

  it("atlas variant applies expected classes", () => {
    render(<Button variant="atlas">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("rounded-full");
    expect(el).toHaveClass("bg-transparent");
    expect(el).toHaveClass("text-ink");
    expect(el).toHaveClass("border-hair");
  });

  it("atlas-ghost applies expected classes", () => {
    render(<Button variant="atlas-ghost">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("rounded-full");
    expect(el).toHaveClass("border-transparent");
    expect(el).toHaveClass("text-ink");
  });

  it("atlas-danger applies expected classes", () => {
    render(<Button variant="atlas-danger">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("rounded-full");
    expect(el).toHaveClass("text-brand");
    expect(el).toHaveClass("border-hair");
  });

  it("atlas size applies expected classes", () => {
    render(<Button variant="atlas" size="atlas">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("h-auto");
    expect(el).toHaveClass("px-[18px]");
    expect(el).toHaveClass("py-[10px]");
    expect(el).toHaveClass("text-[13px]");
    expect(el).toHaveAttribute("data-size", "atlas");
  });

  it("atlas-sm size applies expected classes", () => {
    render(<Button variant="atlas" size="atlas-sm">Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el).toHaveClass("h-auto");
    expect(el).toHaveClass("px-3");
    expect(el).toHaveClass("py-1.5");
    expect(el).toHaveClass("text-[12px]");
  });
});
