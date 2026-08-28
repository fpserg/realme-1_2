import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationTag = "20260828104500_step_103_admission_versioned_world_model";
const migration = readFileSync(
  join(process.cwd(), `supabase/migrations/${migrationTag}.sql`),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(
    join(process.cwd(), "supabase/migrations/meta/_journal.json"),
    "utf8",
  ),
);
const priorSnapshot = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/meta/20260827130916_snapshot.json",
    ),
    "utf8",
  ),
);
const snapshot = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/meta/20260828104500_snapshot.json",
    ),
    "utf8",
  ),
);

describe("Step 103 admission database contract", () => {
  it("is a continuous thirteenth Drizzle migration without rewriting accepted history", () => {
    const sqlMigrations = readdirSync(
      join(process.cwd(), "supabase/migrations"),
    ).filter((name) => name.endsWith(".sql"));
    expect(sqlMigrations).toHaveLength(13);
    expect(journal.entries).toHaveLength(13);
    expect(journal.entries.map((entry: { idx: number }) => entry.idx)).toEqual(
      Array.from({ length: 13 }, (_, index) => index),
    );
    expect(
      journal.entries.filter(
        (entry: { tag: string }) => entry.tag === migrationTag,
      ),
    ).toHaveLength(1);
    expect(journal.entries[12]).toMatchObject({ idx: 12, tag: migrationTag });
    expect(snapshot.prevId).toBe(priorSnapshot.id);
    expect(snapshot.id).not.toBe(priorSnapshot.id);
  });

  it("keeps canonical mutation behind explicit authenticated admission", () => {
    expect(migration).toContain("v_actor_id uuid := (SELECT auth.uid())");
    expect(migration).toContain(
      "p_action NOT IN ('accept', 'reject', 'correct', 'defer')",
    );
    expect(migration).toContain("admission_decisions_final_candidate_unique");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.decide_candidate",
    );
    expect(migration).toContain("TO authenticated");
  });

  it("makes replay and conflicting final outcomes database-enforced", () => {
    expect(migration).toContain(
      "WHERE decision_kind IN ('accept', 'reject', 'correct')",
    );
    expect(migration).toContain(
      "Candidate already has a conflicting final decision.",
    );
    expect(migration).toContain("Correction replay payload does not match");
    expect(migration).toContain("was_replay boolean");
  });

  it("keeps reject and defer non-canonical", () => {
    const rejectBoundary = migration.indexOf("IF p_action = 'reject' THEN");
    const canonicalInsert = migration.indexOf(
      "INSERT INTO public.assertions",
      rejectBoundary,
    );
    expect(rejectBoundary).toBeGreaterThan(0);
    expect(canonicalInsert).toBeGreaterThan(rejectBoundary);
    expect(migration).toContain("'candidate_deferred'");
  });

  it("resolves Step 102-shaped subjects through active same-World canonical aliases", () => {
    expect(migration).toContain("count(DISTINCT alias.node_id)::integer");
    expect(migration).toContain("alias.world_id = v_world_id");
    expect(migration).toContain("alias.valid_to IS NULL");
    expect(migration).toContain(
      "lower(regexp_replace(btrim(alias.alias), '\\s+', ' ', 'g'))",
    );
    expect(migration).toContain("IF v_alias_match_count = 1 THEN");
    expect(migration).toContain("ELSIF v_alias_match_count > 1 THEN");
    expect(migration).toContain("Subject identity is ambiguous");
    expect(migration).toContain("Subject identity is unresolved");
  });

  it("validates any proposed subject UUID against same-World canonical identity", () => {
    expect(migration).toContain(
      "node.id = v_candidate.proposed_subject_node_id",
    );
    expect(migration).toContain(
      "alias.node_id = v_candidate.proposed_subject_node_id",
    );
    expect(migration).toContain(
      "Proposed subject identity is incompatible with the admitted subject.",
    );
  });

  it("creates identity only for explicitly admitted classification when no alias resolves", () => {
    expect(migration).toContain("ELSIF v_predicate = 'classification' THEN");
    expect(migration).toContain("INSERT INTO public.ontology_nodes");
    expect(migration).toContain("INSERT INTO public.ontology_aliases");
    expect(migration).toContain("'user'");
    expect(migration).not.toContain("authority_kind, 'policy'");
  });

  it("preserves immutable candidate evidence and append-oriented supersession", () => {
    expect(migration).toContain("INSERT INTO public.assertion_evidence");
    expect(migration).toContain("FROM public.candidate_claim_evidence AS link");
    expect(migration).toContain("supersedes_assertion_id");
    expect(migration).toContain("assertions_successor_unique");
    expect(migration).toContain(
      "v_prior_valid_from + interval '1 microsecond'",
    );
    expect(migration).not.toContain("DELETE FROM public.candidate_claims");
    expect(migration).not.toContain("UPDATE public.candidate_claims");
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
