# Step 102 — Interpretation and Durable Job Pipeline

Version: 1.0

Status: ACCEPTED — STEP 102 COMPLETE

Opened by: Warden

Opened on: 2026-08-21

Accepted by: Warden

Accepted on: 2026-08-27

Step 103: NOT STARTED

Risk: Tier H

Forward migration:
`20260821063159_step_102_interpretation_durable_job_pipeline`

Forward correction migration:
`20260827130916_step_102_worker_recovery_and_reconciliation`

## Outcome and gate

Step 102 connects already-persisted observation evidence to a durable,
server-only interpretation worker. Model output may become a hidden
non-canonical candidate, never admitted understanding.

Acceptance gate:

> Duplicate delivery cannot create duplicate observations, candidates or
> canonical changes.

Independent Inspector review and explicit Warden acceptance confirmed that the
implementation passes this gate.

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
If its worker disappears, atomic stale recovery closes the abandoned run as
failed, terminalizes the job as failed/exhausted and clears its lock without
creating attempt N+1. Attempts cannot exceed `max_attempts`, and non-running
jobs retain no lock.

Persisted observations are reconciled through the same idempotent enqueue
command in bounded oldest-missing batches of at most 50. The authenticated
server derives actor and World authority, scans observations actually missing
the frozen logical Step 102 job and advances deterministically beyond the
visible history window. This repairs ordinary post-capture enqueue loss without
making browser lifetime the durable worker. Observation capture and temporal
placement remain successful even when enqueue, dispatch, provider or validation
fails.

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
one-companion dialogue. The accepted implementation has one normal-runtime
OpenAI Responses API adapter. Provider selection, model selection, API key,
endpoint and direct worker database URL are server-only. Browser input cannot
activate the deterministic test fixture.

The direct worker connection is fail-closed against the accepted environment
boundary. Loopback PostgreSQL hosts are allowed only when the RealMe environment
is explicitly local development. Preview, staging and production reject
loopback hosts. Managed direct and Supabase pooler URLs must match
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

Accepted verification applied both Step 102 forward migrations to synthetic
staging. The original rollback-only suite proved duplicate enqueue convergence,
cross-World denial, hidden-table denial, exact evidence linkage, cross-World
link rejection, strict candidate payload enforcement, candidate uniqueness,
canonical non-mutation and evidence/temporal survival. The correction suite
proved stale final-attempt terminalization without attempt N+1, idempotent
recovery, repair of an older missing job outside the visible newest 50 and
oldest-missing progress of 50 then 11 across 61 missing jobs.

Staging finished with exactly 12 migrations, zero Auth users, zero rows across
24 product tables and RLS on all 24 tables. Ordinary clients retain no grants
on jobs, interpretation runs, candidate claims or candidate evidence. Enqueue
and reconciliation remain authenticated commands with server-derived authority
and empty search paths; final-attempt terminalization is not client-executable.
The staging security advisor reports eight intentional warnings for the eight
reviewed authenticated command-mediated `SECURITY DEFINER` signatures. No
unrelated index or advisory-remediation campaign is part of Step 102.

Local verification passed formatting, ESLint, strict TypeScript,
architecture-boundary enforcement, Drizzle consistency, 37 test files with 156
tests and a production build. Exact-head GitHub Actions run 33075979674 passed,
including Chromium installation and the mobile smoke test. The Netlify Deploy
Preview also succeeded at the accepted implementation head. The Interpretation
and Durable Job Pipeline acceptance gate passed.

Production remained unchanged with zero RealMe migrations, zero RealMe public
product tables, zero Auth users and no interpretation-provider rollout.

## Acceptance record and preserved laws

Independent Tier H Inspector review returned `APPROVE` for exact implementation
head `910f82821b515724e9fe4bd039d0a8cdff349f44`, tree
`46b9cf0317b97814dfd06358e2e5b8b8faf31dfa`, against base/main
`2774cb811e9754434d0ee8765342f284a48f60d4`. The Warden explicitly accepted
Step 102 at that reviewed head and tree on 2026-08-27.

Acceptance preserves these laws:

- enqueue idempotency is durable and World-scoped; duplicate delivery converges
  through the observation, job kind, prompt and schema identity and cannot
  create duplicate observations, candidates or canonical changes;
- PostgreSQL job claiming is atomic, lock-token protected and bounded;
  stale-lock recovery preserves failed attempts, while an abandoned final
  attempt terminalizes its run and job as failed/exhausted without attempt N+1;
- each immutable attempt/run preserves provider, model, prompt version, schema
  version, deterministic input hash, timing and failure classification;
- structured candidate validation is strict and deterministic, and logical
  identity and deduplication use deterministic canonical hashing;
- candidate persistence retains exact source-fragment evidence links, and
  candidate, evidence, successful run and successful job completion commit in
  one transaction or roll back together;
- retry, backoff and exhaustion are bounded, and durable reconciliation scans
  oldest observations actually missing the frozen logical job in batches of at
  most 50 without depending on the visible history window;
- loopback worker PostgreSQL is restricted to explicitly authorized local
  development; preview, staging and production retain fail-closed managed
  project-reference, data-classification and TLS checks;
- jobs, interpretation runs, candidates and candidate evidence remain hidden
  unresolved state, and AI output remains non-canonical candidate state only;
- Step 102 has no direct mutation path to admission decisions, ontology nodes,
  aliases, relationships, assertions, assertion evidence, commitments or
  projections.

No live authenticated Step 102 interpretation inference has yet been
demonstrated. Deterministic provider-adapter and worker evidence is sufficient
for Step 102 acceptance. A synthetic live-provider smoke remains prudent before
provider rollout and does not make Step 102 incomplete.

Production `public.rls_auto_enable()` execution-grant remediation remains
mandatory before the first RealMe production migration and was not performed by
Step 102.

Step 102 is accepted and complete. PR #20 remains draft and unmerged pending
narrow acceptance-delta verification. Step 103 is not started and remains
unauthorized.
