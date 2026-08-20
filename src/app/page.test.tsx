import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeView } from "./page";

describe("HomeView", () => {
  it("keeps an unconfigured build truthful and unformed", () => {
    render(<HomeView state={{ kind: "configuration-needed" }} />);

    expect(
      screen.getByRole("heading", { name: "A private World begins here." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("97 accepted · 98 not started"),
    ).toBeInTheDocument();
    expect(screen.getByText("Build not configured")).toBeInTheDocument();
    expect(screen.getByText("Unformed by design")).toBeInTheDocument();
  });

  it("shows the bounded provisioned state without inventing ontology", () => {
    render(<HomeView state={{ kind: "ready" }} />);

    expect(
      screen.getByRole("heading", { name: "Your private World is ready." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Private · owner")).toBeInTheDocument();
    expect(screen.getByText("Present · unnamed")).toBeInTheDocument();
  });
});
