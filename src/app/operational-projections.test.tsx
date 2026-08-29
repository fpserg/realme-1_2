import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperationalProjections } from "./operational-projections";

describe("OperationalProjections", () => {
  it("renders stale Today state and a separate future Horizon", () => {
    render(
      <OperationalProjections
        today={[
          {
            classificationAssertionId:
              "10400000-0000-4000-8000-000000000100",
            commitmentId: "10400000-0000-4000-8000-000000000010",
            dueAssertionId: "10400000-0000-4000-8000-000000000102",
            dueLocalDate: "2026-08-28",
            isStale: true,
            status: "open",
            statusAssertionId: "10400000-0000-4000-8000-000000000103",
            surface: "today",
            title: "File report",
            titleAssertionId: "10400000-0000-4000-8000-000000000101",
          },
        ]}
        horizon={[
          {
            classificationAssertionId:
              "10400000-0000-4000-8000-000000000200",
            commitmentId: "10400000-0000-4000-8000-000000000020",
            dueAssertionId: "10400000-0000-4000-8000-000000000202",
            dueLocalDate: "2026-09-04",
            isStale: false,
            status: "open",
            statusAssertionId: "10400000-0000-4000-8000-000000000203",
            surface: "horizon",
            title: "Review proposal",
            titleAssertionId: "10400000-0000-4000-8000-000000000201",
          },
        ]}
      />,
    );

    expect(screen.getByText("File report")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Review proposal")).toBeInTheDocument();
    expect(screen.getByText("2026-09-04")).toBeInTheDocument();
  });
});
