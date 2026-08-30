import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const step104Tag =
  "20260829195000_step_104_commitments_operational_projections";
const migrationPath = `supabase/migrations/${step104Tag}.sql`;

describe("Step 104 commitment projections", () => {
  it("extends the custom migration journal exactly once without a schema snapshot", async () => {
    const [journal, migrations, metadata] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readdir("supabase/migrations"),
      readdir("supabase/migrations/meta"),
    ]);
    const entries = JSON.parse(journal).entries;

    expect(entries[13]).toMatchObject({ idx: 13, tag: step104Tag });
    expect(entries).toHaveLength(14);
    expect(metadata).not.toContain("20260829195000_snapshot.json");
    expect(migrations.filter((name) => name.endsWith(".sql"))).toHaveLength(14);
  });

  it("projects canonical commitment facts while aliases remain presentation-only", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(
      /CREATE OR REPLACE VIEW public\.commitment_projection_source/i,
    );
    expect(sql).toMatch(/WITH \(security_invoker = true\)/i);
    expect(sql).toContain("'classification'");
    expect(sql).toContain("'commitment_title'");
    expect(sql).toContain("'commitment_due_local_date'");
    expect(sql).toContain("'commitment_status'");
    expect(sql).toMatch(/lower\(pivoted\.classification\) = 'commitment'/i);
    expect(sql).toMatch(/LEFT JOIN active_alias/i);
    expect(sql).not.toMatch(/active_alias\.alias_count\s*=\s*1/i);
    expect(sql).toMatch(/min\(alias\.alias\).*alias_title/i);
    expect(sql).toContain("'Untitled commitment'");
    expect(sql).toMatch(
      /WHEN pivoted\.admitted_title IS NOT NULL[\s\S]*THEN pivoted\.title_assertion_id[\s\S]*ELSE NULL/i,
    );
    expect(sql).toMatch(
      /pivoted\.status IN \('open', 'completed', 'cancelled'\)/i,
    );
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE/i);
    expect(sql).not.toMatch(
      /INSERT INTO public\.(observations|candidate_claims|admission_decisions|ontology_nodes|ontology_aliases|ontology_relationships|assertions|assertion_evidence)/i,
    );
  });

  it("derives Today, Horizon and stale state through accepted Step 100 physical containment", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const helper = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION private.resolve_operational_date_for_anchor",
      ),
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.list_operational_commitments",
      ),
    );
    const fn = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.list_operational_commitments",
      ),
    );

    expect(helper).toMatch(
      /private\.resolve_operational_period_for_anchor\([\s\S]*p_anchor_at/i,
    );
    expect(helper).not.toMatch(/AT TIME ZONE[\s\S]*operational_day_boundary/i);
    expect(fn).toMatch(/v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(fn).toMatch(/count\(\*\), min\(membership\.world_id::text\)::uuid/i);
    expect(fn).toMatch(/v_world_count <> 1/i);
    expect(fn).not.toMatch(/p_world_id|p_actor_id/i);
    expect(fn).toMatch(/SET search_path = ''/i);
    expect(fn).toMatch(
      /private\.resolve_operational_date_for_anchor\([\s\S]*statement_timestamp\(\)/i,
    );
    expect(fn).not.toMatch(/AT TIME ZONE|v_local_now|v_boundary/i);
    expect(fn).toMatch(
      /p_surface = 'today'[\s\S]*due_local_date <= v_operational_date/i,
    );
    expect(fn).toMatch(
      /p_surface = 'horizon'[\s\S]*due_local_date > v_operational_date[\s\S]*p_horizon_days/i,
    );
    expect(fn).toMatch(/p_horizon_days < 1 OR p_horizon_days > 90/i);
    expect(fn).toMatch(/due_local_date < v_operational_date AS is_stale/i);
    expect(fn).toMatch(
      /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/i);
  });

  it("carries deterministic DST, alias-cardinality and rebuild regressions", async () => {
    const sql = await readFile(
      "scripts/verify-step-104-projection-rebuild.sql",
      "utf8",
    );

    expect(sql).toMatch(/^begin;/i);
    expect(sql).toContain("normal civil day");
    expect(sql).toContain("spring DST gap");
    expect(sql).toContain("fall DST fold");
    expect(sql).toContain("exact resolved boundary");
    expect(sql).toContain("immediately before boundary");
    expect(sql).toContain("immediately after boundary");
    expect(sql).toContain("admitted title + multiple active aliases");
    expect(sql).toContain("no admitted title + multiple aliases");
    expect(sql).toContain("canonical truth fingerprint");
    expect(sql).toContain("destroy projection");
    expect(sql).toContain("rebuild projection");
    expect(sql).toContain("projection equivalence");
    expect(sql).toContain("canonical truth unchanged");
    expect(sql).toMatch(/rollback;\s*$/i);
  });
});
