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
  const nodes = [...canonical.nodes].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const relationships = [...canonical.relationships].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const realmIds = nodes
    .filter((node) => isRealm(node.classification))
    .map((node) => node.id);
  const depths = new Map<string, number>(realmIds.map((id) => [id, 0]));
  const queue = [...realmIds];

  while (queue.length > 0) {
    const sourceId = queue.shift();
    if (!sourceId) break;
    const sourceDepth = depths.get(sourceId);
    if (sourceDepth === undefined) continue;

    for (const relationship of relationships) {
      if (
        relationship.sourceNodeId !== sourceId ||
        !nodeById.has(relationship.targetNodeId)
      ) {
        continue;
      }

      const nextDepth = sourceDepth + 1;
      const currentDepth = depths.get(relationship.targetNodeId);
      if (currentDepth === undefined || nextDepth < currentDepth) {
        depths.set(relationship.targetNodeId, nextDepth);
        queue.push(relationship.targetNodeId);
      }
    }
  }

  const visibleNodes = nodes.filter((node) => depths.has(node.id));
  const levels = new Map<number, CanonicalLivingWorldNode[]>();
  for (const node of visibleNodes) {
    const depth = depths.get(node.id);
    if (depth === undefined) continue;
    const level = levels.get(depth) ?? [];
    level.push(node);
    levels.set(depth, level);
  }

  const horizontalGap = 180;
  const verticalGap = 130;
  const margin = 70;
  const maxLevelSize = Math.max(
    1,
    ...[...levels.values()].map((level) => level.length),
  );
  const width = Math.max(
    320,
    margin * 2 + (maxLevelSize - 1) * horizontalGap,
  );
  const maxDepth = Math.max(0, ...depths.values());
  const height = Math.max(220, margin * 2 + maxDepth * verticalGap);

  const projectedNodes: LivingWorldNode[] = [];
  for (const [depth, level] of [...levels.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    level.sort((left, right) => compareText(left.id, right.id));
    const levelWidth = (level.length - 1) * horizontalGap;
    const startX = (width - levelWidth) / 2;

    level.forEach((node, index) => {
      projectedNodes.push({
        ...node,
        canonicalId: node.id,
        depth,
        isRealm: isRealm(node.classification),
        x: startX + index * horizontalGap,
        y: margin + depth * verticalGap,
      });
    });
  }

  projectedNodes.sort((left, right) =>
    compareText(left.canonicalId, right.canonicalId),
  );
  const visibleIds = new Set(
    projectedNodes.map((node) => node.canonicalId),
  );
  const edges = relationships
    .filter(
      (relationship) =>
        visibleIds.has(relationship.sourceNodeId) &&
        visibleIds.has(relationship.targetNodeId),
    )
    .map((relationship) => ({
      canonicalRelationshipId: relationship.id,
      predicate: relationship.predicate,
      sourceId: relationship.sourceNodeId,
      targetId: relationship.targetNodeId,
    }));

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
