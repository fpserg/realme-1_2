# Step 102 — Interpretation and Durable Job Pipeline

Status: OPEN — IMPLEMENTATION CANDIDATE — NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-21

Step 103: NOT STARTED

Risk: Tier H

Forward migration:
`20260821063159_step_102_interpretation_durable_job_pipeline`

## Outcome and gate

Step 102 connects already-persisted observation evidence to a durable,
server-only interpretation worker. Model output may become a hidden
non-canonical candidate, never admitted understanding.

Acceptance gate:

> Duplicate delivery cannot create duplicate observations, candidates or
> canonical changes.

This candidate has not passed that gate until independent Inspector review and
explicit Warden acceptance.

## Durable identities

An `interpret_observation` job belongs to one World and one persisted
observation. Its durable idempotency key is derived from the observation,
prompt version and schema version and is protected by the accepted
`(world_id, job_kind, idempotency_key)` uniqueness boundary. Duplicate enqueue
returns the same job.

Each claim increments the durable attempt number and receives a database lock
token. An interpretation run is one model attempt, uniquely identified by
`(job_id, attempt_number)`. Failed runs remain failed provenance; retry creates
a new attempt/run. At most one run per job may succeed.

Each validated candidate receives a SHA-256 logical key over its normalized
payload and sorted exact fragment identities. `(job_id, logical_key)` is
unique. Replayed delivery therefore converges without creating a second
logical result.

## Claiming, recovery and retry

The PostgreSQL worker adapter claims at most one eligible row with
`FOR UPDATE SKIP LOCKED`, increments attempts and writes a UUID lock token in
one transaction. Only that token may complete or fail the job. A running lock
older than five minutes is reclaimable; any prior running interpretation run
is closed as a timed-out failed attempt before the successor begins.

Provider unavailability and timeout are retryable. Delay begins at 30 seconds,
doubles per attempt and is capped at 30 minutes. Configuration, cancellation,
malformed output and deterministic validation failure do not retry. A job that
uses its final allowed attempt ends with the bounded `exhausted` failure code.
Attempts cannot exceed `max_attempts`, and non-running jobs retain no lock.

Persisted observations are reconciled through the same idempotent enqueue
command in bounded batches of at most 50. This repairs ordinary post-capture
enqueue loss without making browser lifetime the durable worker. Observation
capture and temporal placement remain successful even when enqueue, dispatch,
provider or validation fails.

## Worker authority

The authenticated enqueue function accepts only an observation UUID. It derives
the actor with `auth.uid()`, resolves the actor's World server-side and rejects
another user's observation. It receives no browser-selected World, actor,
provider or model. Generic authenticated writes and reads on jobs, runs and
candidates remain denied.

Execution uses a server-only POST dispatch endpoint protected by an independent
minimum-32-character secret and constant-time digest comparison. The endpoint
accepts no job, World, user, SQL or provider parameters. It resolves one job
from database state. There is no GET side effect and no public arbitrary worker
runner.

## Provider and provenance

Interpretation uses an application-owned provider interface distinct from
one-companion dialogue. The candidate implementation has one normal-runtime
OpenAI Responses API adapter. Provider selection, model selection, API key,
endpoint and direct worker database URL are server-only. Browser input cannot
activate the deterministic test fixture.

The direct worker connection is fail-closed against the accepted environment
boundary. Managed direct and Supabase pooler URLs must match
`REALME_EXPECTED_SUPABASE_PROJECT_REF`, require TLS and preserve the synthetic
preview/staging or personal production classification. Arbitrary PostgreSQL
hosts and cross-context project references are rejected. Prepared statements
are disabled for transaction-pooler compatibility.

The immutable application versions are:

- prompt: `interpret-observation-v1`;
- structured output schema: `candidate-set-v1`.

Every started run records the actual provider, model, prompt version, schema
version, attempt number, input hash and bounded status/failure timing. Failure
records never contain raw provider bodies, prompts, evidence, credentials,
stack traces or authorization headers.

The SHA-256 input hash covers the observation identity, ordered exact fragment
identities, ordinals, content hashes, exact text and both semantic versions. It
excludes execution timestamps and other unstable operational values.

## Input and structured candidates

The worker resolves evidence from durable source fragments after claiming the
job. It sends at most eight fragments and 16,000 characters. Request-local
references such as `evidence-0` preserve exact-fragment trace without sending
canonical database UUIDs merely for provenance. Evidence text is untrusted
data under a server-owned interpretation instruction.

The strict `candidate-set-v1` result contains at most eight propositions. Each
proposition contains only:

- bounded subject and lower-snake-case predicate;
- a literal string, finite number or boolean object;
- bounded explanation and confidence;
- one or more exact request-local evidence references.

Unknown keys, unsupported kinds, object/array values, oversized content,
invalid confidence, invalid or duplicate references and duplicate normalized
candidates fail deterministically. No candidate set is partially accepted.

Successful persistence is one transaction: candidates, exact
`candidate_claim_evidence` links, successful run state and successful job
state. If any insert or final state transition fails, the transaction rolls
back and the run/job remains truthfully non-successful.

## Hidden, non-canonical state

Jobs, interpretation runs, candidate claims and candidate evidence remain
hidden from anon and ordinary authenticated clients. Step 102 adds no candidate
review interface.

The worker has no write path to admission decisions, ontology nodes, aliases,
relationships, assertions, assertion evidence, commitments or projections.
Candidate creation is not admission. Step 102 introduces no trigger or adapter
that can turn model output into canonical truth.

Evidence-bearing Step 101 dialogue reuses the same Step 99 observation and
Step 102 enqueue path. Transient dialogue produces no observation and no job.
Interpretation failure cannot erase evidence or operational-period membership.

## Environment boundary

Synthetic staging may receive the forward Step 102 migration and synthetic,
fully cleaned verification only. Production remains unmigrated and has no
interpretation provider rollout. Production `public.rls_auto_enable()`
execution-grant remediation remains mandatory before the first RealMe
production migration.

Candidate verification applied only
`20260821063159_step_102_interpretation_durable_job_pipeline` to synthetic
staging. Rollback-only verification proved duplicate enqueue convergence,
cross-World denial, hidden-table denial, exact evidence linkage, cross-World
link rejection, strict candidate payload enforcement, candidate uniqueness,
canonical non-mutation and evidence/temporal survival. Staging finished with
exactly 11 migrations, zero Auth users, zero rows across 24 product tables and
RLS on all 24 tables. The exact enqueue signature alone is executable by
`authenticated`; `anon` and `PUBLIC` cannot execute it and ordinary clients
retain no grants on the four hidden pipeline tables.

The staging security advisor reports seven intentional warnings for the seven
already-reviewed command-mediated `SECURITY DEFINER` signatures, including the
new enqueue command. Its empty search path, same-World authority and exact
grant were inspected directly. Performance advice remains informational and
primarily reflects the empty synthetic database; no unrelated index campaign
is part of Step 102.

Deterministic fixture-provider tests are the current provider evidence. No live
authenticated interpretation inference was run. Synthetic preview/branch
contexts select OpenAI model `gpt-5.4-mini-2026-03-17`, but remain inert without
separately configured server-only API, database and dispatch secrets. No
provider secret is committed and production provider configuration remains
absent. A synthetic live smoke remains prudent before eventual provider rollout
but does not make the durable pipeline depend on production enablement.

Step 103 admission, candidate review and canonical mutation are not started and
remain unauthorized.
