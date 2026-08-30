import { describe, expect, it } from "vitest";

import {
  LIVING_WORLD_RENDERER_VERSION,
  composeLivingWorld,
  type CanonicalLivingWorldState,
} from "./living-world";

const worldId = "10500000-0000-4000-8000-000000000001";
const realmId = "10500000-0000-4000-8000-000000000010";
const childId = "10500000-0000-4000-8000-000000000011";
const grandchildId = "10500000-0000-4000-8000-000000000012";
const deepId = "10500000-0000-4000-8000-000000000013";

const state = (
  overrides: Partial<CanonicalLivingWorldState> = {},
): CanonicalLivingWorldState => ({
  nodes: [{ classification: "Realm", id: realmId, label: "Life" }],
  relationships: [],
  worldId,
  ...overrides,
});

describe("composeLivingWorld", () => {
  it("keeps a World without an admitted Realm visually sparse", () => {
    const projection = composeLivingWorld(
      state({
        nodes: [{ classification: "Practice", id: childId, label: "Football" }],
      }),
    );

    expect(projection.nodes).toEqual([]);
    expect(projection.edges).toEqual([]);
    expect(projection.rendererVersion).toBe(LIVING_WORLD_RENDERER_VERSION);
  });

  it("renders multiple Realms and arbitrary-depth admitted descendants", () => {
    const secondRealmId = "10500000-0000-4000-8000-000000000020";
    const projection = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: secondRealmId, label: "Work" },
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
          { classification: "Circle", id: grandchildId, label: "Club" },
          { classification: "Place", id: deepId, label: "Pitch" },
        ],
        relationships: [
          { id: "r3", predicate: "contains", sourceNodeId: grandchildId, targetNodeId: deepId },
          { id: "r1", predicate: "contains", sourceNodeId: realmId, targetNodeId: childId },
          { id: "r2", predicate: "contains", sourceNodeId: childId, targetNodeId: grandchildId },
        ],
      }),
    );

    expect(projection.nodes.map(({ canonicalId, depth }) => [canonicalId, depth])).toEqual([
      [realmId, 0],
      [childId, 1],
      [grandchildId, 2],
      [deepId, 3],
      [secondRealmId, 0],
    ]);
    expect(projection.nodes.every((node) => node.canonicalId === node.id)).toBe(true);
  });

  it("is deterministic despite canonical return ordering", () => {
    const canonical = state({
      nodes: [
        { classification: "Practice", id: childId, label: "Football" },
        { classification: "Realm", id: realmId, label: "Life" },
      ],
      relationships: [
        { id: "r1", predicate: "contains", sourceNodeId: realmId, targetNodeId: childId },
      ],
    });
    const reordered = {
      ...canonical,
      nodes: [...canonical.nodes].reverse(),
      relationships: [...canonical.relationships].reverse(),
    };

    expect(composeLivingWorld(reordered)).toEqual(composeLivingWorld(canonical));
  });

  it("adds admitted structure without replacing existing identity", () => {
    const before = composeLivingWorld(state());
    const after = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
        ],
        relationships: [
          { id: "r1", predicate: "contains", sourceNodeId: realmId, targetNodeId: childId },
        ],
      }),
    );

    expect(before.nodes[0]?.canonicalId).toBe(realmId);
    expect(after.nodes.find((node) => node.canonicalId === realmId)?.canonicalId).toBe(realmId);
    expect(after.nodes.find((node) => node.canonicalId === childId)?.depth).toBe(1);
  });

  it("reclassification and parent movement change composition without changing node identity", () => {
    const first = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
          { classification: "Place", id: grandchildId, label: "Pitch" },
        ],
        relationships: [
          { id: "r1", predicate: "contains", sourceNodeId: realmId, targetNodeId: childId },
          { id: "r2", predicate: "contains", sourceNodeId: childId, targetNodeId: grandchildId },
        ],
      }),
    );
    const evolved = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Realm", id: childId, label: "Football" },
          { classification: "Place", id: grandchildId, label: "Pitch" },
        ],
        relationships: [
          { id: "r3", predicate: "contains", sourceNodeId: realmId, targetNodeId: grandchildId },
        ],
      }),
    );

    expect(first.nodes.find((node) => node.canonicalId === childId)?.depth).toBe(1);
    expect(evolved.nodes.find((node) => node.canonicalId === childId)).toMatchObject({
      canonicalId: childId,
      classification: "Realm",
      depth: 0,
    });
    expect(first.nodes.find((node) => node.canonicalId === grandchildId)?.depth).toBe(2);
    expect(evolved.nodes.find((node) => node.canonicalId === grandchildId)?.depth).toBe(1);
  });

  it("can be discarded and regenerated without changing canonical truth", () => {
    const canonical = state({
      nodes: [
        { classification: "Realm", id: realmId, label: "Life" },
        { classification: "Practice", id: childId, label: "Football" },
      ],
      relationships: [
        { id: "r1", predicate: "contains", sourceNodeId: realmId, targetNodeId: childId },
      ],
    });
    const fingerprintBefore = JSON.stringify(canonical);
    const first = composeLivingWorld(canonical);
    const regenerated = composeLivingWorld(JSON.parse(JSON.stringify(canonical)) as CanonicalLivingWorldState);

    expect(regenerated).toEqual(first);
    expect(JSON.stringify(canonical)).toBe(fingerprintBefore);
  });
});
