import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeView } from "./page";

const livingWorld = {
  edges: [],
  height: 220,
  nodes: [],
  rendererVersion: "living-world-code-v1" as const,
  structuralHash: "00000000",
  width: 320,
  worldId: "10500000-0000-4000-8000-000000000001",
};

describe("HomeView", () => {
  it("keeps an unconfigured build truthful and unformed", () => {
    render(<HomeView state={{ kind: "configuration-needed" }} />);

    expect(
      screen.getByRole("heading", { name: "A private World begins here." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("104 accepted · 105 implementation candidate"),
    ).toBeInTheDocument();
    expect(screen.getByText("Build not configured")).toBeInTheDocument();
    expect(screen.getByText("Derived only")).toBeInTheDocument();
  });

  it("shows the code-native Living World beside accepted operational surfaces", () => {
    render(
      <HomeView
        state={{
          accountId: "123e4567-e89b-42d3-a456-426614174000",
          candidates: [],
          horizon: [],
          kind: "ready",
          livingWorld,
          observations: [],
          temporal: { currentPeriod: null, setting: null },
          today: [],
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Living World" }),
    ).toBeInTheDocument();
    const commitments = screen.getByRole("region", { name: "Commitments" });
    expect(
      within(commitments).getByRole("heading", { name: "Today" }),
    ).toBeInTheDocument();
    expect(
      within(commitments).getByRole("heading", { name: "Horizon · 30 days" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dialogue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nothing waiting for review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What should be remembered?" }),
    ).toBeInTheDocument();
  });
});
