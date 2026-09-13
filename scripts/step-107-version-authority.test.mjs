import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260913060000_step_107_interpretation_job_version_authority.sql",
  import.meta.url,
);

const migration = await readFile(migrationUrl, "utf8");

test("durable job constraint accepts prompt v1 and v2 with candidate-set-v1 only", () => {
  assert.match(migration, /payload->>'prompt_version' IN \([\s\S]*'interpret-observation-v1',[\s\S]*'interpret-observation-v2'[\s\S]*\)/);
  assert.match(migration, /payload->>'schema_version' = 'candidate-set-v1'/);
  assert.doesNotMatch(migration, /interpret-observation-v999/);
});

test("enqueue activates v2 without rewriting historical jobs", () => {
  assert.match(migration, /observation:%s:prompt:%s:schema:%s/);
  assert.match(migration, /'interpret-observation-v2'/);
  assert.doesNotMatch(migration, /UPDATE public\.jobs[\s\S]*prompt_version/);
});

test("reconciliation skips any succeeded interpretation regardless of prompt version", () => {
  assert.match(migration, /successful_job\.status = 'succeeded'/);
  assert.match(migration, /successful_job\.observation_id = observation\.id/);
  assert.doesNotMatch(migration, /successful_job\.payload->>'prompt_version'/);
});

test("reconciliation blocks duplicate queued or running v2 and permits failed or cancelled v1 history", () => {
  assert.match(migration, /active_job\.status IN \('queued', 'running'\)/);
  assert.match(migration, /active_job\.payload->>'prompt_version' = 'interpret-observation-v2'/);
  assert.doesNotMatch(migration, /status IN \('failed', 'cancelled'\)/);
});

test("migration adds no pilot-specific ids or cancellation surface", () => {
  assert.doesNotMatch(migration, /0e665e6b|7f1e82b6|59573e7f|d3f14170|bb161234|086f4d72/i);
  assert.doesNotMatch(migration, /cancel_interpretation|cancel_observation_interpretation/i);
  assert.doesNotMatch(migration, /candidate_claims|admission_decisions|ontology_nodes|assertions/);
});
