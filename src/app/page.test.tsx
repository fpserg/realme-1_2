import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeView } from "./page";

describe("HomeView", () => {
  it("keeps an unconfigured build truthful and unformed", () => {
    render(<HomeView state={{ kind: "configuration-needed" }} />);

    expect(
      screen.getByRole("heading", { name: "A private World begins here." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("103 accepted · 104 implementation candidate"),
    ).toBeInTheDocument();
    expect(screen.getByText("Build not configured")).toBeInTheDocument();
    expect(screen.getByText("Derived only")).toBeInTheDocument();
  });

  it("shows disposable Today and Horizon projections beside the accepted surfaces", () => {
    render(
      <HomeView
        state={{
          accountId: "123e4567-e89b-42d3-a456-426614174000",
          candidates: [],
          horizon: [],
          kind: "ready",
          observations: [],
          temporal: { currentPeriod: null, setting: null },
          today: [],
        }}
      />,
    );

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
