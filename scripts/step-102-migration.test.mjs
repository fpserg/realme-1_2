import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const tag = "20260821063159_step_102_interpretation_durable_job_pipeline";
const migrationPath = `supabase/migrations/${tag}.sql`;

describe("Step 102 interpretation pipeline migration", () => {
  it("keeps the forward migration, journal and snapshot aligned", async () => {
    const [journal, snapshot, migrations] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readFile("supabase/migrations/meta/20260821063159_snapshot.json", "utf8"),
      readdir("supabase/migrations"),
    ]);
    const entries = JSON.parse(journal).entries;
    expect(entries.at(-1)).toMatchObject({ idx: 10, tag });
    expect(JSON.parse(snapshot)).toMatchObject({
      prevId: "d4cdf3e1-2e53-44b8-8589-257892cda038",
    });
    expect(migrations.filter((name) => name.endsWith(".sql"))).toHaveLength(11);
  });

  it("adds durable job, run and candidate identities without new tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(
      /ALTER TABLE public\.jobs[\s\S]*observation_id uuid[\s\S]*lock_token uuid/i,
    );
    expect(sql).toMatch(/interpretation_runs_job_attempt_unique/i);
    expect(sql).toMatch(/interpretation_runs_one_success_per_job_unique/i);
    expect(sql).toMatch(/candidate_claims_job_logical_key_unique/i);
    expect(sql).toMatch(/candidate_claims_step_102_payload_check/i);
    expect(sql).not.toMatch(/CREATE TABLE/i);
  });

  it("derives enqueue authority and exposes one exact authenticated command", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const fn = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.enqueue_observation_interpretation",
      ),
    );
    expect(fn).toMatch(/v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(fn).toMatch(/observation\.recorded_by_account_id = v_actor_id/i);
    expect(fn).not.toMatch(/p_world_id|p_actor_id|p_provider|p_model/i);
    expect(fn).toMatch(
      /ON CONFLICT \(world_id, job_kind, idempotency_key\) DO NOTHING/i,
    );
    expect(fn).toMatch(
      /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/i);
  });

  it("keeps atomic worker claim and persistence logic server-only", async () => {
    const repository = await readFile(
      "src/infrastructure/postgres/interpretation-job-repository.ts",
      "utf8",
    );
    expect(repository).toMatch(/for update skip locked/i);
    expect(repository).toMatch(/lock_token/i);
    expect(repository).toMatch(
      /public\.candidate_claims[\s\S]*public\.candidate_claim_evidence/i,
    );
    expect(repository).toMatch(/transaction/);
    expect(repository).not.toMatch(/auth\.uid|request\.json/i);
  });

  it("contains no candidate-to-canonical write path", async () => {
    const files = await Promise.all([
      readFile(migrationPath, "utf8"),
      readFile(
        "src/infrastructure/postgres/interpretation-job-repository.ts",
        "utf8",
      ),
    ]);
    const source = files.join("\n");
    expect(source).not.toMatch(
      /INSERT INTO public\.(admission_decisions|ontology_nodes|ontology_aliases|ontology_relationships|assertions|assertion_evidence)/i,
    );
  });

  it("carries rollback-only synthetic verification", async () => {
    const sql = await readFile(
      "scripts/verify-step-102-interpretation.sql",
      "utf8",
    );
    expect(sql).toMatch(/^begin;/i);
    expect(sql).toMatch(/rollback;\s*$/i);
    for (const phrase of [
      "duplicate enqueue",
      "cross-world enqueue",
      "hidden client tables",
      "exact evidence link",
      "cross-world exact evidence link",
      "duplicate candidate",
      "invalid candidate payload",
      "canonical non-mutation",
      "observation survives failure",
    ]) {
      expect(sql).toContain(phrase);
    }
  });
});
