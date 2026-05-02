import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
// `act` is used for synchronous keydown dispatch on window.
import userEvent from "@testing-library/user-event";

vi.mock("@/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/" }),
}));

import { CommandK } from "./CommandK";
import { apiFetch } from "@/api";

const mockedApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

const fakeConference = {
  id: "conf-1",
  name: "RustConf",
  locationName: "Albuquerque, NM",
  latitude: 35.0,
  longitude: -106.6,
  startDate: "2026-09-12",
  endDate: "2026-09-14",
  source: null,
  topics: [],
  url: null,
};

const fakeUser = {
  id: "user-1",
  avatarId: 3,
  displayName: "Ada Lovelace",
  photoURL: null,
};

function setupApiFetch() {
  mockedApiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/conferences"))
      return Promise.resolve({ conferences: [fakeConference] });
    if (path.startsWith("/users"))
      return Promise.resolve({ users: [fakeUser] });
    if (path.startsWith("/tags"))
      return Promise.resolve({ tags: [], groups: {} });
    return Promise.resolve({});
  });
}

describe("CommandK", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    setupApiFetch();
  });

  it("renders nothing visible when open=false", () => {
    render(
      <CommandK
        open={false}
        onOpenChange={() => {}}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    expect(
      screen.queryByPlaceholderText(/Search conferences, people/i),
    ).not.toBeInTheDocument();
  });

  it("renders a focused search input when open=true", async () => {
    render(
      <CommandK
        open={true}
        onOpenChange={() => {}}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    const input = await screen.findByPlaceholderText(
      /Search conferences, people/i,
    );
    expect(input).toBeInTheDocument();
  });

  it("Cmd+K on window calls onOpenChange(true)", () => {
    const onOpenChange = vi.fn();
    render(
      <CommandK
        open={false}
        onOpenChange={onOpenChange}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("Ctrl+K on window calls onOpenChange(true)", () => {
    const onOpenChange = vi.fn();
    render(
      <CommandK
        open={false}
        onOpenChange={onOpenChange}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("pressing Escape while open calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CommandK
        open={true}
        onOpenChange={onOpenChange}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    await screen.findByPlaceholderText(/Search conferences, people/i);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders results from apiFetch (1 conference + 1 user)", async () => {
    render(
      <CommandK
        open={true}
        onOpenChange={() => {}}
        onPickConference={() => {}}
        onPickUser={() => {}}
      />,
    );
    const input = await screen.findByPlaceholderText(
      /Search conferences, people/i,
    );
    fireEvent.change(input, { target: { value: "rust" } });
    expect(
      await screen.findByText("RustConf", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Ada Lovelace", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it("clicking a conference row calls onPickConference with that conference", async () => {
    const onPickConference = vi.fn();
    render(
      <CommandK
        open={true}
        onOpenChange={() => {}}
        onPickConference={onPickConference}
        onPickUser={() => {}}
      />,
    );
    const input = await screen.findByPlaceholderText(
      /Search conferences, people/i,
    );
    fireEvent.change(input, { target: { value: "rust" } });
    const row = await screen.findByText(
      "RustConf",
      {},
      { timeout: 2000 },
    );
    fireEvent.click(row);
    expect(onPickConference).toHaveBeenCalledWith(fakeConference);
  });
});
