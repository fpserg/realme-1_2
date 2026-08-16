import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("states that product migration has not begun", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "The foundation is taking form." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unformed by design")).toBeInTheDocument();
  });
});
