import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const path =
  "supabase/migrations/20261005130041_candidate_set_v2_epistemic_assertions.sql";
const sql = await readFile(path, "utf8");

describe("Step 107 Phase 4P candidate-set-v2 migration", () => {
  it("keeps durable prompt/schema authority closed and versioned", () => {
    expect(sql).toContain("interpret-observation-v4");
    expect(sql).toContain("candidate-set-v2");
    expect(sql).toMatch(
      /interpret-observation-v1','interpret-observation-v2','interpret-observation-v3'[\s\S]*candidate-set-v1/,
    );
    expect(sql).toMatch(/interpret-observation-v4'[\s\S]*candidate-set-v2/);
    expect(sql).toContain("observation:%s:prompt:%s:schema:%s");
    expect(sql).toMatch(/successful_job\.status = 'succeeded'/);
    expect(sql).toMatch(
      /active_job\.payload->>'prompt_version' = 'interpret-observation-v4'/,
    );
    expect(sql).not.toContain(
      "'interpret-observation-v4' AND payload->>'schema_version' = 'candidate-set-v1'",
    );
  });

  it("defines only simple and epistemic candidates with a finite vocabulary", () => {
    expect(sql).toContain("p->>'kind' = 'proposition'");
    expect(sql).toContain("p->>'kind' = 'epistemic_proposition'");
    expect(sql).toContain(
      "('estimate','belief','assessment','report','feeling')",
    );
    expect(sql).toContain("(p->'epistemic') - ARRAY['actor','mode']");
    expect(sql).not.toMatch(
      /participant|qualifier_relation|event_node|event_identity/i,
    );
  });

  it("stores qualified truth separately without projecting the embedded core", () => {
    expect(sql).toMatch(/CREATE TABLE public\.epistemic_assertions/);
    expect(sql).toMatch(/CREATE TABLE public\.epistemic_assertion_evidence/);
    expect(sql).toMatch(/no_embedded_ordinary_assertion/);
    expect(sql).toContain("Embedded epistemic content is not ordinary truth.");
    const qualifiedBranch = sql.slice(
      sql.indexOf(
        "IF v_is_v2 AND v_payload->>'kind' = 'epistemic_proposition'",
      ),
      sql.indexOf("v_subject := v_payload->>'subject'"),
    );
    expect(qualifiedBranch).toContain(
      "INSERT INTO public.epistemic_assertions",
    );
    expect(qualifiedBranch).not.toContain("INSERT INTO public.assertions");
    expect(sql).not.toMatch(
      /CREATE OR REPLACE VIEW public\.commitment_projection_source/,
    );
    expect(sql).not.toMatch(
      /list_operational_commitments|list_living_world|list_canonical_understanding/,
    );
  });

  it("requires exact same-World identities and exact candidate evidence", () => {
    expect(sql).toMatch(
      /resolve_epistemic_identity\(v_world_id,v_payload->>'subject'\)/,
    );
    expect(sql).toMatch(
      /resolve_epistemic_identity\(v_world_id,v_payload->'epistemic'->>'actor'\)/,
    );
    expect(sql).toMatch(/FOREIGN KEY \(world_id,subject_node_id\)/);
    expect(sql).toMatch(/FOREIGN KEY \(world_id,epistemic_actor_node_id\)/);
    expect(sql).toMatch(/FOREIGN KEY \(world_id,source_fragment_id\)/);
    expect(sql).toContain("Exact candidate evidence required.");
    expect(sql).toContain("Evidence must support the admitted semantic unit.");
  });

  it("uses UUID identity, coexistence by default, explicit correction lineage and replay", () => {
    expect(sql).toMatch(/id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).not.toMatch(
      /UNIQUE \(world_id,subject_node_id,predicate,value,epistemic_actor_node_id,epistemic_mode\)/,
    );
    expect(sql).toMatch(/supersedes_epistemic_assertion_id uuid UNIQUE/);
    expect(sql).toContain(
      "Only explicit correction may close an epistemic version.",
    );
    expect(sql).toMatch(/admitted_by_decision_id uuid NOT NULL UNIQUE/);
    expect(sql).toMatch(
      /was_replay boolean,[\s\S]*canonical_epistemic_assertion_id uuid/,
    );
  });

  it("hardens Tier H tables and the authenticated authority surface", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.epistemic_assertions ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.epistemic_assertion_evidence ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.epistemic_assertions[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /CREATE FUNCTION public\.decide_candidate[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.decide_candidate[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.decide_candidate[\s\S]*TO authenticated/,
    );
  });
});
