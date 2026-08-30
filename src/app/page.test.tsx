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

const readyState = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  candidates: [],
  horizon: [],
  kind: "ready" as const,
  livingWorld,
  observations: [],
  temporal: { currentPeriod: null, setting: null },
  today: [],
};

describe("HomeView", () => {
  it("keeps unauthenticated and unconfigured access bounded and truthful", () => {
    const { rerender } = render(
      <HomeView state={{ kind: "configuration-needed" }} />,
    );

    expect(
      screen.getByRole("heading", { name: "A private World begins here." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Build not configured")).toBeInTheDocument();
    expect(screen.getByText("User only")).toBeInTheDocument();
    expect(screen.getByText("Derived only")).toBeInTheDocument();

    rerender(<HomeView state={{ kind: "signed-out" }} />);
    expect(
      screen.getByRole("link", { name: "Sign in or create account" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("integrates the accepted core loop behind product-language navigation", () => {
    render(<HomeView state={readyState} />);

    const navigation = screen.getByRole("navigation", {
      name: "RealMe core loop",
    });
    expect(
      within(navigation).getByRole("link", { name: "Capture" }),
    ).toHaveAttribute("href", "#capture");
    expect(
      within(navigation).getByRole("link", { name: "Companion" }),
    ).toHaveAttribute("href", "#companion");
    expect(
      within(navigation).getByRole("link", { name: "Review" }),
    ).toHaveAttribute("href", "#review");
    expect(
      within(navigation).getByRole("link", { name: "Today & Horizon" }),
    ).toHaveAttribute("href", "#projections");
    expect(
      within(navigation).getByRole("link", { name: "World" }),
    ).toHaveAttribute("href", "#world");

    expect(
      screen.getByRole("region", { name: "Capture and continuity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Companion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "Interpretation review and admission",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Operational projections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "World understanding" }),
    ).toBeInTheDocument();
  });

  it("keeps authority states perceivable without inventing empty truth", () => {
    render(<HomeView state={readyState} />);

    const guide = screen.getByRole("complementary", {
      name: "One loop, four authority states",
    });
    expect(within(guide).getByText("You said")).toBeInTheDocument();
    expect(within(guide).getByText("RealMe interpreted")).toBeInTheDocument();
    expect(within(guide).getByText("You admitted")).toBeInTheDocument();
    expect(within(guide).getByText("Projected")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Nothing to interpret yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Capture an observation first. Empty state is preserved without invented understanding.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nothing waiting for review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No admitted Realms yet. The World remains visually unformed.",
      ),
    ).toBeInTheDocument();
  });

  it("labels Today, Horizon and Living World as derived projections", () => {
    render(<HomeView state={readyState} />);

    const commitments = screen.getByRole("region", { name: "Commitments" });
    expect(
      within(commitments).getByRole("heading", { name: "Today" }),
    ).toBeInTheDocument();
    expect(
      within(commitments).getByRole("heading", { name: "Horizon · 30 days" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Today and Horizon are rebuildable operational views derived from admitted facts and authoritative time.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The Living World is a disposable visual projection. At the current canonical boundary it shows admitted Realm roots only; sparse output is truthful.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Living World" }),
    ).toBeInTheDocument();
  });

  it("represents unresolved candidates as non-canonical review work", () => {
    render(
      <HomeView
        state={{
          ...readyState,
          candidates: [
            {
              createdAt: "2026-08-30T10:00:00.000Z",
              evidence: [],
              explanation: "Classification candidate",
              id: "10600000-0000-4000-8000-000000000001",
              object: "Realm",
              predicate: "classification",
              proposedSubjectNodeId: null,
              subject: "Work",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Review is ready" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Nothing becomes canonical until you explicitly accept or correct it/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to review" })).toHaveAttribute(
      "href",
      "#review",
    );
  });
});
