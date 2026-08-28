import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828104500_step_103_admission_versioned_world_model.sql",
  ),
  "utf8",
);

describe("Step 103 admission database contract", () => {
  it("keeps canonical mutation behind explicit authenticated admission", () => {
    expect(migration).toContain("v_actor_id uuid := (SELECT auth.uid())");
    expect(migration).toContain("p_action NOT IN ('accept', 'reject', 'correct', 'defer')");
    expect(migration).toContain("admission_decisions_final_candidate_unique");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.decide_candidate");
    expect(migration).toContain("TO authenticated");
  });

  it("makes replay and conflicting final outcomes database-enforced", () => {
    expect(migration).toContain("WHERE decision_kind IN ('accept', 'reject', 'correct')");
    expect(migration).toContain("Candidate already has a conflicting final decision.");
    expect(migration).toContain("Correction replay payload does not match");
    expect(migration).toContain("was_replay boolean");
  });

  it("keeps reject and defer non-canonical", () => {
    const rejectBoundary = migration.indexOf("IF p_action = 'reject' THEN");
    const canonicalInsert = migration.indexOf("INSERT INTO public.assertions", rejectBoundary);
    expect(rejectBoundary).toBeGreaterThan(0);
    expect(canonicalInsert).toBeGreaterThan(rejectBoundary);
    expect(migration).toContain("'candidate_deferred'");
  });

  it("preserves immutable candidate evidence and append-oriented supersession", () => {
    expect(migration).toContain("INSERT INTO public.assertion_evidence");
    expect(migration).toContain("FROM public.candidate_claim_evidence AS link");
    expect(migration).toContain("supersedes_assertion_id");
    expect(migration).toContain("assertions_successor_unique");
    expect(migration).not.toContain("DELETE FROM public.candidate_claims");
    expect(migration).not.toContain("UPDATE public.candidate_claims");
  });

  it("preserves stable node identity for reclassification and requires a user decision for Realm classification", () => {
    expect(migration).toContain("v_subject_node_id := v_candidate.proposed_subject_node_id");
    expect(migration).toContain("IF v_predicate = 'classification' AND v_subject_node_id IS NULL THEN");
    expect(migration).toContain("'user'");
    expect(migration).not.toContain("authority_kind, 'policy'");
  });

  it("denies generic client writes to admission and canonical tables", () => {
    for (const table of [
      "admission_decisions",
      "ontology_nodes",
      "ontology_aliases",
      "ontology_relationships",
      "assertions",
      "assertion_evidence",
    ]) {
      expect(migration).toContain(
        `REVOKE INSERT, UPDATE, DELETE ON public.${table} FROM anon, authenticated`,
      );
    }
  });
});
