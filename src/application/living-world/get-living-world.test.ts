import { describe, expect, it } from "vitest";

import type { CanonicalLivingWorldState } from "@/domain/living-world/living-world";

import {
  LivingWorldIsolationError,
  getLivingWorld,
  type LivingWorldRepository,
} from "./get-living-world";

const worldId = "10500000-0000-4000-8000-000000000001";

class StubRepository implements LivingWorldRepository {
  constructor(private readonly canonical: CanonicalLivingWorldState) {}

  async loadCanonicalStructure() {
    return this.canonical;
  }
}

describe("getLivingWorld", () => {
  it("projects only the server-selected World", async () => {
    const projection = await getLivingWorld(
      worldId,
      new StubRepository({
        nodes: [
          {
            classification: "Realm",
            id: "10500000-0000-4000-8000-000000000010",
            label: "Life",
          },
        ],
        relationships: [],
        worldId,
      }),
    );

    expect(projection.worldId).toBe(worldId);
    expect(projection.nodes).toHaveLength(1);
  });

  it("fails closed if a repository crosses World isolation", async () => {
    await expect(
      getLivingWorld(
        worldId,
        new StubRepository({
          nodes: [],
          relationships: [],
          worldId: "10500000-0000-4000-8000-000000000099",
        }),
      ),
    ).rejects.toBeInstanceOf(LivingWorldIsolationError);
  });
});
