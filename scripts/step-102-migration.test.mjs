import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const pipelineTag =
  "20260821063159_step_102_interpretation_durable_job_pipeline";
const correctionTag =
  "20260827130916_step_102_worker_recovery_and_reconciliation";
const migrationPath = `supabase/migrations/${pipelineTag}.sql`;
const correctionPath = `supabase/migrations/${correctionTag}.sql`;

describe("Step 102 interpretation pipeline migration", () => {
  it("keeps the forward migration, journal and snapshot aligned", async () => {
    const [journal, snapshot, correctionSnapshot, migrations] =
      await Promise.all([
        readFile("supabase/migrations/meta/_journal.json", "utf8"),
        readFile(
          "supabase/migrations/meta/20260821063159_snapshot.json",
          "utf8",
        ),
        readFile(
          "supabase/migrations/meta/20260827130916_snapshot.json",
          "utf8",
        ),
        readdir("supabase/migrations"),
      ]);
    const entries = JSON.parse(journal).entries;
    const pipelineSnapshot = JSON.parse(snapshot);
    expect(entries.at(-1)).toMatchObject({ idx: 11, tag: correctionTag });
    expect(pipelineSnapshot).toMatchObject({
      prevId: "d4cdf3e1-2e53-44b8-8589-257892cda038",
    });
    expect(JSON.parse(correctionSnapshot)).toMatchObject({
      prevId: pipelineSnapshot.id,
    });
    expect(migrations.filter((name) => name.endsWith(".sql"))).toHaveLength(13);
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
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.enqueue_observation_interpretation/i);
    expect(sql).toMatch(/v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.enqueue_observation_interpretation\(uuid\) TO authenticated/i);
  });

  it("keeps atomic worker claim and persistence logic server-only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(sql).toMatch(/lock_token/i);
    expect(sql).toMatch(/candidate_claim_evidence/i);
    expect(sql).toMatch(/interpretation_runs_one_success_per_job_unique/i);
  });

  it("adds bounded database recovery and missing-job reconciliation only forward", async () => {
    const sql = await readFile(correctionPath, "utf8");
    expect(sql).toMatch(/reconcile_observation_interpretations/i);
    expect(sql).toMatch(/LIMIT 50/i);
    expect(sql).toMatch(/oldest/i);
  });

  it("contains no candidate-to-canonical write path", async () => {
    const [pipeline, correction] = await Promise.all([
      readFile(migrationPath, "utf8"),
      readFile(correctionPath, "utf8"),
    ]);
    for (const sql of [pipeline, correction]) {
      expect(sql).not.toMatch(/INSERT INTO public\.admission_decisions/i);
      expect(sql).not.toMatch(/INSERT INTO public\.assertions/i);
      expect(sql).not.toMatch(/INSERT INTO public\.ontology_nodes/i);
    }
  });

  it("carries rollback-only synthetic verification", async () => {
    const sql = await readFile(correctionPath, "utf8");
    expect(sql).toMatch(/ROLLBACK/i);
  });
});
