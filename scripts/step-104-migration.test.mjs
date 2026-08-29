import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const step104Tag = "20260829195000_step_104_commitments_operational_projections";
const migrationPath = `supabase/migrations/${step104Tag}.sql`;

describe("Step 104 commitment projections", () => {
  it("extends the migration chain exactly once", async () => {
    const [journal, snapshot, previousSnapshot, migrations] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readFile("supabase/migrations/meta/20260829195000_snapshot.json", "utf8"),
      readFile("supabase/migrations/meta/20260828104500_snapshot.json", "utf8"),
      readdir("supabase/migrations"),
    ]);
    const entries = JSON.parse(journal).entries;
    const current = JSON.parse(snapshot);
    const previous = JSON.parse(previousSnapshot);

    expect(entries[13]).toMatchObject({ idx: 13, tag: step104Tag });
    expect(current.prevId).toBe(previous.id);
    expect(current.id).not.toBe(previous.id);
    expect(migrations.filter((name) => name.endsWith(".sql"))).toHaveLength(14);
  });

  it("projects commitment identity and versioned facts without creating a second truth store", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/CREATE OR REPLACE VIEW public\.commitment_projection_source/i);
    expect(sql).toMatch(/WITH \(security_invoker = true\)/i);
    expect(sql).toMatch(/assertion\.subject_node_id AS commitment_id/i);
    expect(sql).toContain("'commitment.title'");
    expect(sql).toContain("'commitment.due_local_date'");
    expect(sql).toContain("'commitment.status'");
    expect(sql).toMatch(/pivoted\.status IN \('open', 'completed', 'cancelled'\)/i);
    expect(sql).toMatch(/title_assertion_id[\s\S]*due_assertion_id[\s\S]*status_assertion_id/i);
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE/i);
    expect(sql).not.toMatch(/INSERT INTO public\.(observations|candidate_claims|admission_decisions|ontology_nodes|ontology_aliases|ontology_relationships|assertions|assertion_evidence)/i);
    expect(sql).not.toMatch(/UPDATE public\.(observations|candidate_claims|admission_decisions|ontology_nodes|ontology_aliases|ontology_relationships|assertions|assertion_evidence)/i);
    expect(sql).not.toMatch(/DELETE FROM public\.(observations|candidate_claims|admission_decisions|ontology_nodes|ontology_aliases|ontology_relationships|assertions|assertion_evidence)/i);
  });

  it("derives World, civil operational date, Today, Horizon and stale state server-side", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const fn = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.list_operational_commitments"));

    expect(fn).toMatch(/v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(fn).toMatch(/count\(\*\), min\(membership\.world_id\)/i);
    expect(fn).toMatch(/v_world_count <> 1/i);
    expect(fn).not.toMatch(/p_world_id|p_actor_id/i);
    expect(fn).toMatch(/SET search_path = ''/i);
    expect(fn).toMatch(/statement_timestamp\(\) AT TIME ZONE v_timezone_name/i);
    expect(fn).toMatch(/v_local_now::time < v_boundary/i);
    expect(fn).not.toMatch(/current_date/i);
    expect(fn).toMatch(/p_surface = 'today'[\s\S]*due_local_date <= v_operational_date/i);
    expect(fn).toMatch(/p_surface = 'horizon'[\s\S]*due_local_date > v_operational_date[\s\S]*p_horizon_days/i);
    expect(fn).toMatch(/p_horizon_days < 1 OR p_horizon_days > 90/i);
    expect(fn).toMatch(/due_local_date < v_operational_date AS is_stale/i);
    expect(fn).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i);
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/i);
  });

  it("carries an explicit rollback-only destroy/rebuild equivalence proof", async () => {
    const sql = await readFile("scripts/verify-step-104-projection-rebuild.sql", "utf8");

    expect(sql).toMatch(/^begin;/i);
    expect(sql).toContain("canonical truth fingerprint");
    expect(sql).toContain("destroy projection");
    expect(sql).toContain("rebuild projection");
    expect(sql).toContain("projection equivalence");
    expect(sql).toContain("canonical truth unchanged");
    expect(sql).toMatch(/rollback;\s*$/i);
  });
});
