export const LIVING_WORLD_RENDERER_VERSION = "living-world-code-v1" as const;

export type CanonicalLivingWorldNode = {
  classification: string | null;
  id: string;
  label: string;
};

export type CanonicalLivingWorldRelationship = {
  id: string;
  predicate: string;
  sourceNodeId: string;
  targetNodeId: string;
};

export type CanonicalLivingWorldState = {
  nodes: CanonicalLivingWorldNode[];
  relationships: CanonicalLivingWorldRelationship[];
  worldId: string;
};

export type LivingWorldNode = CanonicalLivingWorldNode & {
  canonicalId: string;
  depth: number;
  isRealm: boolean;
  x: number;
  y: number;
};

export type LivingWorldEdge = {
  canonicalRelationshipId: string;
  predicate: string;
  sourceId: string;
  targetId: string;
};

export type LivingWorldProjection = {
  edges: LivingWorldEdge[];
  height: number;
  nodes: LivingWorldNode[];
  rendererVersion: typeof LIVING_WORLD_RENDERER_VERSION;
  structuralHash: string;
  width: number;
  worldId: string;
};

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

const isRealm = (classification: string | null) =>
  classification?.trim().toLocaleLowerCase("en-US") === "realm";

const hashText = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function composeLivingWorld(
  canonical: CanonicalLivingWorldState,
): LivingWorldProjection {
  const realmNodes = [...canonical.nodes]
    .filter((node) => isRealm(node.classification))
    .sort((left, right) => compareText(left.id, right.id));

  // Step 105 intentionally gives generic ontology relationships no structural
  // authority. The accepted canonical model does not yet define a universal
  // containment relation, so only admitted Realm roots are structurally visible.
  // Keeping relationships on CanonicalLivingWorldState preserves the projection
  // boundary for a later accepted structural law without fabricating one now.
  const horizontalGap = 180;
  const margin = 70;
  const width = Math.max(
    320,
    margin * 2 + Math.max(0, realmNodes.length - 1) * horizontalGap,
  );
  const height = 220;
  const levelWidth = Math.max(0, realmNodes.length - 1) * horizontalGap;
  const startX = (width - levelWidth) / 2;

  const projectedNodes: LivingWorldNode[] = realmNodes.map((node, index) => ({
    ...node,
    canonicalId: node.id,
    depth: 0,
    isRealm: true,
    x: startX + index * horizontalGap,
    y: margin,
  }));

  const edges: LivingWorldEdge[] = [];
  const structuralValue = JSON.stringify({
    edges,
    nodes: projectedNodes.map(
      ({ canonicalId, classification, depth, label, x, y }) => ({
        canonicalId,
        classification,
        depth,
        label,
        x,
        y,
      }),
    ),
    rendererVersion: LIVING_WORLD_RENDERER_VERSION,
    worldId: canonical.worldId,
  });

  return {
    edges,
    height,
    nodes: projectedNodes,
    rendererVersion: LIVING_WORLD_RENDERER_VERSION,
    structuralHash: hashText(structuralValue),
    width,
    worldId: canonical.worldId,
  };
}
