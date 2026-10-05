import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "vitest";

const migration = await readFile(
  join(
    process.cwd(),
    "supabase/migrations/20260913054404_lazy_absorbing_man.sql",
  ),
  "utf8",
);

const reconciliation = migration.slice(
  migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.reconcile_observation_interpretations",
  ),
);

const currentVersionPresencePredicate = reconciliation.slice(
  reconciliation.indexOf("FROM public.jobs AS active_job"),
  reconciliation.indexOf(")\n    ORDER BY observation.recorded_at"),
);

test("durable job constraint accepts prompt v1 and v2 with candidate-set-v1 only", () => {
  assert.match(
    migration,
    /payload"->>'prompt_version' in \('interpret-observation-v1', 'interpret-observation-v2'\)/i,
  );
  assert.match(migration, /payload"->>'schema_version' = 'candidate-set-v1'/i);
  assert.doesNotMatch(migration, /interpret-observation-v999/);
});

test("enqueue activates v2 without rewriting historical jobs", () => {
  assert.match(migration, /observation:%s:prompt:%s:schema:%s/);
  assert.match(migration, /'interpret-observation-v2'/);
  assert.doesNotMatch(migration, /UPDATE public\.jobs[\s\S]*prompt_version/);
});

test("reconciliation suppresses succeeded interpretation regardless of prompt version", () => {
  assert.match(reconciliation, /successful_job\.status = 'succeeded'/);
  assert.match(
    reconciliation,
    /successful_job\.observation_id = observation\.id/,
  );
  assert.doesNotMatch(
    reconciliation,
    /successful_job\.payload->>'prompt_version'/,
  );
});

test("current-version presence suppresses queued, running, failed, cancelled, and succeeded v2", () => {
  assert.match(
    currentVersionPresencePredicate,
    /active_job\.payload->>'prompt_version' = 'interpret-observation-v2'/,
  );
  assert.match(
    currentVersionPresencePredicate,
    /active_job\.payload->>'schema_version' = 'candidate-set-v1'/,
  );
  assert.doesNotMatch(currentVersionPresencePredicate, /active_job\.status/);
});

test("failed or cancelled v1 without v2 history remains eligible for one v2 job", () => {
  assert.doesNotMatch(reconciliation, /successful_job\.status IN/i);
  assert.doesNotMatch(
    currentVersionPresencePredicate,
    /interpret-observation-v1/,
  );
  assert.doesNotMatch(reconciliation, /status IN \('failed', 'cancelled'\)/);
});

test("no-history observation remains eligible and terminal v2 cannot loop as processed", () => {
  assert.match(reconciliation, /AND NOT EXISTS \([\s\S]*successful_job/);
  assert.match(reconciliation, /AND NOT EXISTS \([\s\S]*active_job/);
  assert.doesNotMatch(currentVersionPresencePredicate, /active_job\.status/);
  assert.match(
    reconciliation,
    /PERFORM \*[\s\S]*enqueue_observation_interpretation\(v_observation_id\)[\s\S]*v_processed := v_processed \+ 1/,
  );
});

test("migration adds no pilot-specific ids or cancellation surface", () => {
  assert.doesNotMatch(
    migration,
    /0e665e6b|7f1e82b6|59573e7f|d3f14170|bb161234|086f4d72/i,
  );
  assert.doesNotMatch(
    migration,
    /cancel_interpretation|cancel_observation_interpretation/i,
  );
  assert.doesNotMatch(
    migration,
    /candidate_claims|admission_decisions|ontology_nodes|assertions/,
  );
});
