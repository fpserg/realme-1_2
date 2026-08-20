# RealMe 1.2 — Step 99 Persist-First Observation Capture

Version: 0.1

Status: OPEN — IMPLEMENTATION CANDIDATE — NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-20

Risk: Tier H — first authenticated write path into constitutional evidence

## 1. Bounded outcome

Step 99 implements text-first observation capture over the accepted Step 98
truth schema.

Capture succeeds when one observation and its exact source fragment are
durably committed. It does not depend on AI, interpretation, candidates,
admission, canonical World Model mutation, projections or a worker.

The candidate provides:

- a mobile-first plain-text capture surface;
- optional explicit occurred-time entry;
- server/database-assigned recorded time;
- durable World-scoped capture idempotency;
- append-only occurred-time correction;
- visible unsynced, saved, processing and failed meanings;
- minimum local recovery for uncertain delivery;
- reload-safe evidence history from server state.

Step 99 does not implement Step 100 operational periods or the 04:00 boundary.
It does not implement companion dialogue, AI, durable job execution, candidate
claims, admission, ontology, Today, Horizon, the Living World, attachments or
production rollout.

## 2. Migration identity

The forward Step 99 migration is:

`20260820185900_step_99_persist_first_observation_capture`

It does not rewrite any accepted Step 97 or Step 98 migration identity.

The migration adds a nullable `observations.capture_idempotency_key`, with a
partial unique index scoped to `(world_id, capture_idempotency_key)`. Existing
non-capture evidence remains representable while every Step 99 capture command
requires a UUID retry identity.

It also tightens `observation_corrections` so a predecessor belongs to the same
World and observation, a correction has at most one direct successor, and an
observation has at most one root correction.

## 3. Authorization design

The Next.js command route verifies the cookie-backed session through
`getClaims()`. It rejects unauthenticated requests and rejects browser-supplied
World, actor or recorded-time authority.

The Supabase adapter invokes two narrowly granted database functions:

- `public.capture_text_observation`;
- `public.correct_observation_occurred_time`.

Both functions:

- obtain the actor through `auth.uid()`;
- derive the initial owner World inside the database;
- use `SECURITY DEFINER` with an empty `search_path` and schema-qualified
  relations;
- revoke default execution from `PUBLIC`, `anon` and `authenticated` before
  granting the exact signature to `authenticated` only;
- validate every caller-controlled value;
- expose no arbitrary SQL, World identity or actor identity.

The security-definer capability is intentional because authenticated clients
retain no generic insert, update or delete privilege on Step 98 tables. It is a
narrow command boundary, not an RLS bypass available to arbitrary relations.
Supabase security-advisor output must therefore be reviewed against these exact
signatures rather than waived generically.

## 4. Persist-first transaction

`capture_text_observation` performs one database transaction that:

1. authenticates the caller and derives their World;
2. validates exact text, retry identity and optional occurred time;
3. inserts the observation without accepting `recorded_at`;
4. inserts ordinal-zero exact source text and a server-computed SHA-256 hash;
5. returns the durable observation identity and server timestamp.

PostgreSQL function execution is transactional. If source-fragment creation
fails, the observation insert rolls back. No interpretation run, candidate,
job, assertion or ontology record is created by capture.

## 5. Idempotency

The client creates a UUID when a draft begins and stores it with the exact text
in the minimum local recovery record. An uncertain retry reuses both values.

The database uniqueness boundary ensures repeated delivery returns the same
observation and original recorded time. Reusing a key with different text or
occurrence metadata is rejected rather than silently resolving to unrelated
evidence.

Capture idempotency is independent of the dormant Step 98 job idempotency
field. Step 102 remains responsible for job and interpretation idempotency.

## 6. Time and correction

Occurred time is optional. Simple capture requires no time ceremony. When the
user supplies an instant, the browser also supplies its IANA timezone and the
database derives the local calendar date. The database validates the timezone.

Recorded time always comes from the observation table's database default.
Neither API parsing nor the database command accepts a recorded timestamp.

Post-save correction appends an `observation_corrections` row and links it to
the previous correction. It never changes the original observation, exact
source fragment, recorded time or prior corrections. The history reader
projects the latest correction for display while retaining correction count.

## 7. Client state law

- `unsynced`: local text has no durable server confirmation;
- `saved`: exact evidence has durable server confirmation;
- `processing`: shown only if legitimate downstream work exists; Step 99 starts
  no such work and does not manufacture this state;
- `failed`: an unsaved attempt was not confirmed and remains locally
  recoverable; it never implies that a saved observation was lost.

After an uncertain attempt, the draft is held with the same retry identity.
The user can retry it unchanged. Editing after uncertainty explicitly creates a
new capture identity. This is a bounded local outbox for one text capture, not a
general offline synchronization subsystem.

## 8. Reload-safe history

The signed-in server page queries observations, exact ordinal-zero fragments
and append-only occurrence corrections through ownership-scoped RLS.
Reconstruction does not depend on in-memory state, a runtime seed or browser
storage. It exposes evidence-level fields only and does not read or reveal
hidden candidates.

## 9. Verification gate

Before this candidate returns for independent review it must:

1. pass `pnpm check` and mobile Chromium coverage;
2. prove unauthenticated rejection and server-derived World authority;
3. prove exact-text, optional occurrence and server-time behavior;
4. prove idempotent retry and transaction rollback on fragment failure;
5. prove append-only correction and cross-World isolation;
6. prove generic authenticated writes remain denied;
7. prove a downstream failure cannot remove saved evidence;
8. apply the exact forward migration to synthetic staging only;
9. execute the database regression in a rollback-only transaction;
10. restore staging to zero synthetic users and product rows;
11. inspect RLS, grants and Supabase security advisors;
12. confirm production remains unmigrated and untouched;
13. obtain exact-head independent Code Review and explicit Warden acceptance.

## 10. Candidate boundary

This record does not accept Step 99. The branch and draft PR must remain
unmerged until independent Code Review and explicit Warden acceptance.

Step 100 is not started.

## 11. Candidate verification record

Local verification on 2026-08-20 passed formatting, ESLint, strict TypeScript,
architecture-boundary enforcement, Drizzle consistency, 14 test files with 50
tests and the production build. The local runner did not contain the required
Playwright Chromium binary; the mobile test remains part of CI, where Chromium
is installed explicitly.

The exact forward migration was applied to RealMe Staging only. Supabase
recorded the immutable identity
`20260820185900_step_99_persist_first_observation_capture`; the repository
migration, journal and snapshot use that same identity.

Rollback-only synthetic staging verification proved:

- unauthenticated capture rejection;
- exact text and omitted or supplied occurred-time persistence;
- database-controlled recorded time;
- duplicate delivery resolving to one observation and one recorded time;
- mismatched idempotency payload rejection;
- complete observation rollback when source-fragment insertion fails;
- survival of saved evidence after a simulated downstream failure;
- append-only two-step occurred-time correction without observation mutation;
- generic authenticated observation insertion remains denied;
- cross-World history remains hidden by RLS.

After rollback, Auth and all 24 product tables contained zero rows. All 24
tables retained RLS, authenticated clients retained zero generic evidence-table
insert, update or delete grants, and anonymous callers could execute neither
Step 99 command.

Supabase security advisors report two expected warnings because the two narrow
authenticated commands are intentionally `SECURITY DEFINER`. Their complete
signatures, empty search paths, actor/World derivation, validation and grants
must receive independent security review; this record does not treat the
warnings as a general waiver. Existing informational performance-advisor debt
is outside this bounded step.

Production remained unchanged with zero RealMe migrations, zero public product
tables and zero Auth users.
