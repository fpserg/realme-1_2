import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CanonicalEvidence,
  CanonicalUnderstandingItem,
  CanonicalUnderstandingRepository,
} from "@/application/world/list-canonical-understanding";

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function readScalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : null;
}

export class SupabaseCanonicalUnderstandingRepository
  implements CanonicalUnderstandingRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async listCurrent(worldId: string) {
    const [assertionsResult, aliasesResult, decisionsResult, evidenceResult, fragmentsResult] =
      await Promise.all([
        this.client
          .from("assertions")
          .select(
            "id, world_id, subject_node_id, object_node_id, predicate, value, valid_from, admitted_by_decision_id, supersedes_assertion_id",
          )
          .eq("world_id", worldId)
          .is("valid_to", null),
        this.client
          .from("ontology_aliases")
          .select("node_id, alias, world_id")
          .eq("world_id", worldId)
          .is("valid_to", null),
        this.client
          .from("admission_decisions")
          .select(
            "id, world_id, candidate_claim_id, decision_kind, authority_kind, decided_at",
          )
          .eq("world_id", worldId),
        this.client
          .from("assertion_evidence")
          .select("assertion_id, source_fragment_id, world_id")
          .eq("world_id", worldId),
        this.client
          .from("source_fragments")
          .select("id, exact_text, world_id")
          .eq("world_id", worldId),
      ]);

    for (const result of [
      assertionsResult,
      aliasesResult,
      decisionsResult,
      evidenceResult,
      fragmentsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const allRows = [
      ...(assertionsResult.data ?? []),
      ...(aliasesResult.data ?? []),
      ...(decisionsResult.data ?? []),
      ...(evidenceResult.data ?? []),
      ...(fragmentsResult.data ?? []),
    ];
    if (allRows.some((row) => row.world_id !== worldId)) {
      throw new Error("Canonical understanding read crossed World isolation.");
    }

    const aliasesByNode = new Map<string, string[]>();
    for (const alias of aliasesResult.data ?? []) {
      const value = typeof alias.alias === "string" ? alias.alias.trim() : "";
      if (!value) continue;
      const aliases = aliasesByNode.get(alias.node_id) ?? [];
      aliases.push(value);
      aliasesByNode.set(alias.node_id, aliases);
    }
    for (const aliases of aliasesByNode.values()) aliases.sort(compareText);

    const decisions = new Map(
      (decisionsResult.data ?? []).map((decision) => [decision.id, decision]),
    );
    const fragments = new Map(
      (fragmentsResult.data ?? []).map((fragment) => [fragment.id, fragment]),
    );
    const evidenceByAssertion = new Map<string, CanonicalEvidence[]>();
    for (const link of evidenceResult.data ?? []) {
      const fragment = fragments.get(link.source_fragment_id);
      if (!fragment) continue;
      const evidence = evidenceByAssertion.get(link.assertion_id) ?? [];
      evidence.push({
        exactText: fragment.exact_text,
        sourceFragmentId: fragment.id,
      });
      evidenceByAssertion.set(link.assertion_id, evidence);
    }

    const items: CanonicalUnderstandingItem[] = [];
    for (const assertion of assertionsResult.data ?? []) {
      if (!assertion.subject_node_id) continue;
      const decision = decisions.get(assertion.admitted_by_decision_id);
      if (
        !decision ||
        decision.authority_kind !== "user" ||
        (decision.decision_kind !== "accept" &&
          decision.decision_kind !== "correct")
      ) {
        throw new Error("Active assertion lacks lawful user admission provenance.");
      }

      const scalar = readScalar(assertion.value);
      const objectLabel = assertion.object_node_id
        ? (aliasesByNode.get(assertion.object_node_id)?.[0] ??
          assertion.object_node_id)
        : null;
      const value = scalar ?? objectLabel;
      if (value === null) continue;

      items.push({
        admissionAction: decision.decision_kind,
        admissionDecisionId: decision.id,
        admittedAt: decision.decided_at,
        assertionId: assertion.id,
        candidateClaimId: decision.candidate_claim_id,
        evidence: [...(evidenceByAssertion.get(assertion.id) ?? [])].sort(
          (left, right) => compareText(left.sourceFragmentId, right.sourceFragmentId),
        ),
        predicate: assertion.predicate,
        subjectLabel:
          aliasesByNode.get(assertion.subject_node_id)?.[0] ??
          "Unlabeled understanding",
        subjectNodeId: assertion.subject_node_id,
        supersedesAssertionId: assertion.supersedes_assertion_id,
        validFrom: assertion.valid_from,
        value,
      });
    }

    return items.sort((left, right) =>
      left.subjectLabel === right.subjectLabel
        ? compareText(left.assertionId, right.assertionId)
        : compareText(left.subjectLabel, right.subjectLabel),
    );
  }
}
