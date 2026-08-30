import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LivingWorldProjection } from "@/domain/living-world/living-world";

import { LivingWorld } from "./living-world";

const emptyProjection: LivingWorldProjection = {
  edges: [],
  height: 220,
  nodes: [],
  rendererVersion: "living-world-code-v1",
  structuralHash: "00000000",
  width: 320,
  worldId: "10500000-0000-4000-8000-000000000001",
};

describe("LivingWorld", () => {
  it("keeps an unformed World visibly sparse", () => {
    render(<LivingWorld projection={emptyProjection} />);

    expect(
      screen.getByRole("region", { name: "Living World" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No admitted Realms yet. The World remains visually unformed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("living-world-code-v1")).toBeInTheDocument();
  });

  it("exposes code-native primitives with canonical identity", () => {
    const { container } = render(
      <LivingWorld
        projection={{
          ...emptyProjection,
          edges: [
            {
              canonicalRelationshipId:
                "10500000-0000-4000-8000-000000000030",
              predicate: "contains",
              sourceId: "10500000-0000-4000-8000-000000000010",
              targetId: "10500000-0000-4000-8000-000000000011",
            },
          ],
          nodes: [
            {
              canonicalId: "10500000-0000-4000-8000-000000000010",
              classification: "Realm",
              depth: 0,
              id: "10500000-0000-4000-8000-000000000010",
              isRealm: true,
              label: "Life",
              x: 160,
              y: 70,
            },
            {
              canonicalId: "10500000-0000-4000-8000-000000000011",
              classification: "Practice",
              depth: 1,
              id: "10500000-0000-4000-8000-000000000011",
              isRealm: false,
              label: "Football",
              x: 160,
              y: 200,
            },
          ],
          structuralHash: "abcdef12",
        }}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Code-native Living World structure" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-canonical-id="10500000-0000-4000-8000-000000000010"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-canonical-id="10500000-0000-4000-8000-000000000011"]',
      ),
    ).not.toBeNull();
    expect(screen.getByText("Practice")).toBeInTheDocument();
    expect(screen.getByText(/structural hash abcdef12/)).toBeInTheDocument();
  });
});
