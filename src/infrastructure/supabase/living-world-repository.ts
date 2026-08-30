import type { SupabaseClient } from "@supabase/supabase-js";

import type { LivingWorldRepository } from "@/application/living-world/get-living-world";
import type {
  CanonicalLivingWorldNode,
  CanonicalLivingWorldRelationship,
} from "@/domain/living-world/living-world";

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

const scalarString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export class SupabaseLivingWorldRepository implements LivingWorldRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadCanonicalStructure(worldId: string) {
    const [nodesResult, aliasesResult, assertionsResult, relationshipsResult] =
      await Promise.all([
        this.client
          .from("ontology_nodes")
          .select("id, world_id")
          .eq("world_id", worldId),
        this.client
          .from("ontology_aliases")
          .select("id, node_id, alias, world_id")
          .eq("world_id", worldId)
          .is("valid_to", null),
        this.client
          .from("assertions")
          .select("id, subject_node_id, predicate, value, world_id")
          .eq("world_id", worldId)
          .eq("predicate", "classification")
          .is("valid_to", null),
        this.client
          .from("ontology_relationships")
          .select("id, subject_node_id, object_node_id, predicate, world_id")
          .eq("world_id", worldId)
          .is("valid_to", null),
      ]);

    for (const result of [
      nodesResult,
      aliasesResult,
      assertionsResult,
      relationshipsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const nodes = nodesResult.data ?? [];
    const aliases = aliasesResult.data ?? [];
    const assertions = assertionsResult.data ?? [];
    const relationships = relationshipsResult.data ?? [];

    if (
      [...nodes, ...aliases, ...assertions, ...relationships].some(
        (row) => row.world_id !== worldId,
      )
    ) {
      throw new Error("Living World read crossed World isolation.");
    }

    const aliasesByNode = new Map<string, string[]>();
    for (const alias of aliases) {
      const label = scalarString(alias.alias);
      if (!label) continue;
      const values = aliasesByNode.get(alias.node_id) ?? [];
      values.push(label);
      aliasesByNode.set(alias.node_id, values);
    }

    const classificationsByNode = new Map<string, string[]>();
    for (const assertion of assertions) {
      if (!assertion.subject_node_id) continue;
      const classification = scalarString(assertion.value);
      if (!classification) continue;
      const values = classificationsByNode.get(assertion.subject_node_id) ?? [];
      values.push(classification);
      classificationsByNode.set(assertion.subject_node_id, values);
    }

    const canonicalNodes: CanonicalLivingWorldNode[] = nodes.map((node) => {
      const labels = [...(aliasesByNode.get(node.id) ?? [])].sort(compareText);
      const classifications = [
        ...(classificationsByNode.get(node.id) ?? []),
      ].sort(compareText);

      return {
        classification:
          classifications.length === 1 ? classifications[0] : null,
        id: node.id,
        label: labels[0] ?? "Unlabeled structure",
      };
    });

    const knownNodeIds = new Set(canonicalNodes.map((node) => node.id));
    const canonicalRelationships: CanonicalLivingWorldRelationship[] =
      relationships
        .filter(
          (relationship) =>
            knownNodeIds.has(relationship.subject_node_id) &&
            knownNodeIds.has(relationship.object_node_id),
        )
        .map((relationship) => ({
          id: relationship.id,
          predicate: relationship.predicate,
          sourceNodeId: relationship.subject_node_id,
          targetNodeId: relationship.object_node_id,
        }))
        .sort((left, right) => compareText(left.id, right.id));

    canonicalNodes.sort((left, right) => compareText(left.id, right.id));

    return {
      nodes: canonicalNodes,
      relationships: canonicalRelationships,
      worldId,
    };
  }
}
