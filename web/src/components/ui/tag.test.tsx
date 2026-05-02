import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tag } from "./tag";

describe("Tag", () => {
  it("renders children", () => {
    render(<Tag>filter</Tag>);
    expect(screen.getByText("filter")).toBeInTheDocument();
  });

  it("applies default classes and data-slot", () => {
    render(<Tag>filter</Tag>);
    const el = screen.getByText("filter");
    expect(el).toHaveAttribute("data-slot", "tag");
    expect(el).toHaveClass("inline-flex");
    expect(el).toHaveClass("border");
    expect(el).toHaveClass("border-hair");
    expect(el).toHaveClass("text-ink2");
    expect(el).toHaveClass("rounded-[6px]");
  });

  it("applies active overrides", () => {
    render(<Tag active>filter</Tag>);
    const el = screen.getByText("filter");
    expect(el).toHaveClass("bg-ink");
    expect(el).toHaveClass("text-bg");
    expect(el).toHaveClass("border-ink");
  });

  it("applies accent overrides when not active", () => {
    render(<Tag accent>filter</Tag>);
    const el = screen.getByText("filter");
    expect(el).toHaveClass("bg-brand-soft");
    expect(el).toHaveClass("text-brand");
  });

  it("active wins over accent", () => {
    render(<Tag active accent>filter</Tag>);
    const el = screen.getByText("filter");
    expect(el).toHaveClass("bg-ink");
    expect(el).toHaveClass("text-bg");
  });

  it("adds cursor-pointer and triggers onClick", () => {
    const onClick = vi.fn();
    render(<Tag onClick={onClick}>filter</Tag>);
    const el = screen.getByText("filter");
    expect(el).toHaveClass("cursor-pointer");
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("merges custom className", () => {
    render(<Tag className="ml-2">filter</Tag>);
    expect(screen.getByText("filter")).toHaveClass("ml-2");
  });
});
