import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "vitest";

const historicalMigration = await readFile(
  join(
    process.cwd(),
    "supabase/migrations/20260913054404_lazy_absorbing_man.sql",
  ),
  "utf8",
);
const migration = await readFile(
  join(
    process.cwd(),
    "supabase/migrations/20260917054136_interpret_observation_v3.sql",
  ),
  "utf8",
);

const enqueue = migration.slice(
  migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.enqueue_observation_interpretation",
  ),
  migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.reconcile_observation_interpretations",
  ),
);
const reconciliation = migration.slice(
  migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.reconcile_observation_interpretations",
  ),
);
const activeVersionPresencePredicate = reconciliation.slice(
  reconciliation.indexOf("FROM public.jobs AS active_job"),
  reconciliation.indexOf(")\n    ORDER BY observation.recorded_at"),
);

test("historical Phase 4H migration remains v1/v2-only provenance", () => {
  assert.match(
    historicalMigration,
    /payload"->>'prompt_version' in \('interpret-observation-v1', 'interpret-observation-v2'\)/i,
  );
  assert.doesNotMatch(historicalMigration, /interpret-observation-v3/);
});

test("v3 forward constraint permits exactly v1, v2, and v3 with candidate-set-v1", () => {
  assert.match(
    migration,
    /payload"->>'prompt_version' in \('interpret-observation-v1', 'interpret-observation-v2', 'interpret-observation-v3'\)/i,
  );
  assert.match(
    migration,
    /\("jobs"\."payload" - array\['prompt_version', 'schema_version'\]\) = '\{\}'::jsonb/i,
  );
  assert.match(migration, /payload"->>'schema_version' = 'candidate-set-v1'/i);
  assert.doesNotMatch(migration, /interpret-observation-v999|candidate-set-v2/);
});

test("enqueue creates the distinct v3 identity without rewriting history", () => {
  assert.match(enqueue, /observation:%s:prompt:%s:schema:%s/);
  assert.match(enqueue, /'interpret-observation-v3'/);
  assert.match(enqueue, /'candidate-set-v1'/);
  assert.match(
    enqueue,
    /ON CONFLICT \(world_id, job_kind, idempotency_key\) DO NOTHING/i,
  );
  assert.doesNotMatch(enqueue, /UPDATE public\.jobs/i);
});

test("successful interpretation of any version suppresses automatic v3", () => {
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

test("every existing v3 status suppresses duplicate v3 creation", () => {
  assert.match(
    activeVersionPresencePredicate,
    /active_job\.payload->>'prompt_version' = 'interpret-observation-v3'/,
  );
  assert.match(
    activeVersionPresencePredicate,
    /active_job\.payload->>'schema_version' = 'candidate-set-v1'/,
  );
  assert.doesNotMatch(activeVersionPresencePredicate, /active_job\.status/);
});

test("old failed or cancelled history and no history remain eligible for one v3", () => {
  assert.doesNotMatch(
    activeVersionPresencePredicate,
    /interpret-observation-v1|interpret-observation-v2/,
  );
  assert.doesNotMatch(reconciliation, /status IN \('failed', 'cancelled'\)/i);
  assert.match(reconciliation, /AND NOT EXISTS \([\s\S]*successful_job/);
  assert.match(reconciliation, /AND NOT EXISTS \([\s\S]*active_job/);
  assert.match(
    reconciliation,
    /PERFORM \*[\s\S]*enqueue_observation_interpretation\(v_observation_id\)[\s\S]*v_processed := v_processed \+ 1/,
  );
});

test("reconciliation remains authenticated, World-scoped, and bounded", () => {
  assert.match(reconciliation, /v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
  assert.match(
    reconciliation,
    /observation\.recorded_by_account_id = v_actor_id/i,
  );
  assert.match(
    reconciliation,
    /membership\.world_id = observation\.world_id[\s\S]*membership\.user_id = v_actor_id/i,
  );
  assert.match(reconciliation, /FOR UPDATE OF observation SKIP LOCKED/i);
  assert.match(reconciliation, /LIMIT 50/i);
});

test("security definer, empty search path, and grants remain fail-closed", () => {
  for (const source of [enqueue, reconciliation]) {
    assert.match(source, /SECURITY DEFINER/i);
    assert.match(source, /SET search_path = ''/i);
    assert.match(source, /authentication required/i);
  }
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.enqueue_observation_interpretation\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated[\s\S]*GRANT EXECUTE[\s\S]*TO authenticated/i,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.reconcile_observation_interpretations\(\)[\s\S]*FROM PUBLIC, anon, authenticated[\s\S]*GRANT EXECUTE[\s\S]*TO authenticated/i,
  );
});

test("migration adds no pilot ids, cancellation surface, or canonical write", () => {
  assert.doesNotMatch(
    migration,
    /0e665e6b|303465d8|78b49183|b032825a|fa722360|46433587|4d1bd708|dcd8b4fb/i,
  );
  assert.doesNotMatch(
    migration,
    /cancel_interpretation|cancel_observation_interpretation/i,
  );
  assert.doesNotMatch(
    migration,
    /candidate_claims|admission_decisions|ontology_nodes|assertions/i,
  );
});
