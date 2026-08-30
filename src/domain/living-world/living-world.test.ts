import { describe, expect, it } from "vitest";

import {
  LIVING_WORLD_RENDERER_VERSION,
  composeLivingWorld,
  type CanonicalLivingWorldState,
} from "./living-world";

const worldId = "10500000-0000-4000-8000-000000000001";
const realmId = "10500000-0000-4000-8000-000000000010";
const secondRealmId = "10500000-0000-4000-8000-000000000020";
const childId = "10500000-0000-4000-8000-000000000011";
const grandchildId = "10500000-0000-4000-8000-000000000012";

const state = (
  overrides: Partial<CanonicalLivingWorldState> = {},
): CanonicalLivingWorldState => ({
  nodes: [{ classification: "Realm", id: realmId, label: "Life" }],
  relationships: [],
  worldId,
  ...overrides,
});

const relationship = (predicate: string, sourceNodeId = realmId, targetNodeId = childId) => ({
  id: `relationship-${predicate}-${sourceNodeId}-${targetNodeId}`,
  predicate,
  sourceNodeId,
  targetNodeId,
});

describe("composeLivingWorld", () => {
  it("renders admitted Realm roots with their stable canonical identities", () => {
    const projection = composeLivingWorld(state());

    expect(projection.nodes).toEqual([
      expect.objectContaining({
        canonicalId: realmId,
        classification: "Realm",
        depth: 0,
        id: realmId,
        isRealm: true,
      }),
    ]);
    expect(projection.edges).toEqual([]);
    expect(projection.rendererVersion).toBe(LIVING_WORLD_RENDERER_VERSION);
  });

  it("renders multiple Realms deterministically", () => {
    const canonical = state({
      nodes: [
        { classification: "Realm", id: secondRealmId, label: "Work" },
        { classification: "Realm", id: realmId, label: "Life" },
      ],
    });

    expect(composeLivingWorld(canonical).nodes.map((node) => node.canonicalId)).toEqual([
      realmId,
      secondRealmId,
    ]);
    expect(composeLivingWorld({ ...canonical, nodes: [...canonical.nodes].reverse() })).toEqual(
      composeLivingWorld(canonical),
    );
  });

  it("keeps a World without an admitted Realm visually sparse", () => {
    const projection = composeLivingWorld(
      state({
        nodes: [{ classification: "Practice", id: childId, label: "Football" }],
      }),
    );

    expect(projection.nodes).toEqual([]);
    expect(projection.edges).toEqual([]);
  });

  it.each([
    "collaborates_with",
    "depends_on",
    "related_to",
    "located_at",
    "supports",
    "owns",
    "unknown_predicate",
    "contains",
  ])("does not treat %s as structural authority", (predicate) => {
    const projection = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
        ],
        relationships: [relationship(predicate)],
      }),
    );

    expect(projection.nodes.map((node) => node.canonicalId)).toEqual([realmId]);
    expect(projection.nodes.some((node) => node.canonicalId === childId)).toBe(false);
    expect(projection.edges).toEqual([]);
  });

  it("does not derive descendant depth from generic relationship chains", () => {
    const projection = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
          { classification: "Place", id: grandchildId, label: "Pitch" },
        ],
        relationships: [
          relationship("related_to", realmId, childId),
          relationship("depends_on", childId, grandchildId),
        ],
      }),
    );

    expect(projection.nodes).toHaveLength(1);
    expect(projection.nodes[0]?.depth).toBe(0);
    expect(projection.edges).toEqual([]);
  });

  it("does not derive structural visibility from generic relationship cycles", () => {
    const projection = composeLivingWorld(
      state({
        nodes: [
          { classification: "Realm", id: realmId, label: "Life" },
          { classification: "Practice", id: childId, label: "Football" },
          { classification: "Place", id: grandchildId, label: "Pitch" },
        ],
        relationships: [
          relationship("related_to", childId, grandchildId),
          relationship("related_to", grandchildId, childId),
          relationship("supports", realmId, childId),
        ],
      }),
    );

    expect(projection.nodes.map((node) => node.canonicalId)).toEqual([realmId]);
    expect(projection.edges).toEqual([]);
  });

  it("keeps generic relationship ordering irrelevant to visible output", () => {
    const canonical = state({
      nodes: [
        { classification: "Realm", id: realmId, label: "Life" },
        { classification: "Practice", id: childId, label: "Football" },
      ],
      relationships: [
        relationship("supports"),
        relationship("collaborates_with", childId, realmId),
      ],
    });
    const reordered = {
      ...canonical,
      nodes: [...canonical.nodes].reverse(),
      relationships: [...canonical.relationships].reverse(),
    };

    expect(composeLivingWorld(reordered)).toEqual(composeLivingWorld(canonical));
  });

  it("changes Realm-root projection through admitted reclassification without identity loss", () => {
    const before = composeLivingWorld(
      state({
        nodes: [{ classification: "Practice", id: childId, label: "Football" }],
      }),
    );
    const after = composeLivingWorld(
      state({
        nodes: [{ classification: "Realm", id: childId, label: "Football" }],
      }),
    );

    expect(before.nodes).toEqual([]);
    expect(after.nodes[0]).toMatchObject({
      canonicalId: childId,
      classification: "Realm",
      depth: 0,
      id: childId,
    });
  });

  it("produces equivalent output for identical canonical state and renderer version", () => {
    const canonical = state({
      nodes: [
        { classification: "Realm", id: realmId, label: "Life" },
        { classification: "Realm", id: secondRealmId, label: "Work" },
      ],
    });

    expect(composeLivingWorld(canonical)).toEqual(composeLivingWorld(canonical));
  });

  it("can be discarded and regenerated without changing canonical truth", () => {
    const canonical = state({
      nodes: [
        { classification: "Realm", id: realmId, label: "Life" },
        { classification: "Practice", id: childId, label: "Football" },
      ],
      relationships: [relationship("contains")],
    });
    const fingerprintBefore = JSON.stringify(canonical);
    const first = composeLivingWorld(canonical);
    const regenerated = composeLivingWorld(
      JSON.parse(JSON.stringify(canonical)) as CanonicalLivingWorldState,
    );

    expect(regenerated).toEqual(first);
    expect(JSON.stringify(canonical)).toBe(fingerprintBefore);
  });
});
