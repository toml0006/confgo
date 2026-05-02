import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonToken, AVATAR_COUNT } from "./PersonToken";

describe("PersonToken", () => {
  it("has data-slot=person-token", () => {
    render(<PersonToken avatarId={0} displayName="Ada" />);
    expect(screen.getByTestId("person-token")).toHaveAttribute(
      "data-slot",
      "person-token",
    );
  });

  it("derives shape deterministically from avatarId", () => {
    // 0 → circle, 1 → triangle, 2 → diamond, 3 → square, 4 → hex, 5 → circle
    const cases: Array<[number, string]> = [
      [0, "circle"],
      [1, "triangle"],
      [2, "diamond"],
      [3, "square"],
      [4, "hex"],
      [5, "circle"],
    ];
    for (const [id, shape] of cases) {
      const { container, unmount } = render(
        <PersonToken avatarId={id} displayName="X" />,
      );
      const root = container.querySelector("[data-slot=person-token]");
      expect(root?.getAttribute("data-shape")).toBe(shape);
      unmount();
    }
  });

  it("renders circle SVG element for avatarId 0", () => {
    const { container } = render(<PersonToken avatarId={0} displayName="A" />);
    expect(container.querySelector("svg circle")).not.toBeNull();
  });

  it("renders polygon for triangle (avatarId 1)", () => {
    const { container } = render(<PersonToken avatarId={1} displayName="A" />);
    expect(container.querySelector("svg polygon")).not.toBeNull();
  });

  it("renders rect for square (avatarId 3)", () => {
    const { container } = render(<PersonToken avatarId={3} displayName="A" />);
    expect(container.querySelector("svg rect")).not.toBeNull();
  });

  it("renders the uppercased first character of displayName", () => {
    const { container } = render(
      <PersonToken avatarId={0} displayName="ada" />,
    );
    const text = container.querySelector("svg text");
    expect(text?.textContent).toBe("A");
  });

  it("renders ? for null displayName", () => {
    const { container } = render(<PersonToken avatarId={0} displayName={null} />);
    const text = container.querySelector("svg text");
    expect(text?.textContent).toBe("?");
  });

  it("renders ? for empty displayName", () => {
    const { container } = render(<PersonToken avatarId={0} displayName="" />);
    const text = container.querySelector("svg text");
    expect(text?.textContent).toBe("?");
  });

  it("exports AVATAR_COUNT as a positive integer", () => {
    expect(AVATAR_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(AVATAR_COUNT)).toBe(true);
  });
});
