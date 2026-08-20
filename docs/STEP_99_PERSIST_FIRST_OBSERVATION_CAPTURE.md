# RealMe 1.2 — Step 99 Persist-First Observation Capture

Version: 1.0

Status: ACCEPTED — STEP 99 COMPLETE

Opened by: Warden

Opened on: 2026-08-20

Accepted by: Warden

Accepted on: 2026-08-20

Risk: Tier H — first authenticated write path into constitutional evidence

## 1. Bounded outcome

Step 99 implements text-first observation capture over the accepted Step 98
truth schema.

Capture succeeds when one observation and its exact source fragment are
durably committed. It does not depend on AI, interpretation, candidates,
admission, canonical World Model mutation, projections or a worker.

The accepted implementation provides:

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
in the minimum local recovery record. The record is namespaced by and contains
the authenticated account identifier supplied by the verified server session.
An uncertain retry by that same account reuses the text and UUID.

Recovery validates the stored account identifier again when the component
loads. A different authenticated account cannot display, populate, retry or
submit the prior account's draft. Each account receives a distinct storage
namespace and a new capture identity for its own draft. A mismatched envelope
found inside the current account's namespace is discarded; the original
account's correctly namespaced envelope remains available when that account
returns.

Capture also sends the envelope owner as a non-authoritative consistency
claim. The server compares it with the subject from fresh `getClaims()` output
and rejects a mismatch before persistence. The claim cannot nominate authority:
the verified session still exclusively determines the actor and World. This
prevents a stale page from submitting Account A's envelope after another auth
flow has replaced the session with Account B.

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
reconstructs effective occurred time from the unique leaf of the durable
correction supersession chain while retaining correction count. It does not
infer semantic order from `recorded_at`. Zero, multiple, disconnected or
cyclic leaves fail safely rather than selecting an arbitrary correction.

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
general offline synchronization subsystem. The local record is recoverable
input only; it is not canonical evidence until the server confirms durable
persistence. Plaintext is removed from the current account's local namespace
after confirmation or explicit clearing.

## 8. Reload-safe history

The signed-in server page queries observations, exact ordinal-zero fragments
and append-only occurrence corrections through ownership-scoped RLS.
Reconstruction does not depend on in-memory state, a runtime seed or browser
storage. It exposes evidence-level fields only and does not read or reveal
hidden candidates.

Account-scoped local recovery is separate from server history. Account
switching cannot surface or submit another account's unsynced draft, while
returning to the originating account restores its still-unsynced envelope.
Effective occurred time after reload comes from the correction supersession
leaf, independent of correction timestamps or query order.

## 9. Acceptance verification gate

Before acceptance, the candidate had to:

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
13. obtain exact-head independent Inspector review and explicit Warden
    acceptance.

## 10. Acceptance boundary

Step 99 is accepted. Acceptance freezes the persist-first observation boundary
described in this record; it does not authorize production migration, personal
data import, AI processing or any Step 100 temporal behavior.

Step 100 was later opened by the Warden through a separate bounded instruction;
that does not reopen or broaden accepted Step 99.

## 11. Acceptance verification record

Local verification on 2026-08-20 passed formatting, ESLint, strict TypeScript,
architecture-boundary enforcement, Drizzle consistency, 15 test files with 55
tests and the production build. The regression suite includes account-switch
isolation at recovery and request boundaries plus supersession-leaf history
reconstruction with tied timestamps and malformed-chain rejection. The local
runner did not contain the required
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
received explicit independent Tier H security review. This acceptance applies
only to those exact signatures and is not a general waiver. Existing
informational performance-advisor debt is outside this bounded step.

Production remained unchanged with zero RealMe migrations, zero public product
tables and zero Auth users.

Exact-head GitHub Actions run 87 and the Netlify Deploy Preview succeeded after
the correction was committed and published.

## 12. Acceptance record and preserved boundaries

Independent Inspector review returned `APPROVE` for exact head
`a24069941b1a4b3e8c78423a9496fcebf8cdb119`, tree
`07843a47405b2f1af8e18989e7936c13be068951`, against base/main
`ffc055b2908f30f007c57f569aa3d7bf72f339d6`. GitHub Actions run 87 and the
Netlify Deploy Preview passed at that exact head.

The Warden explicitly accepted Step 99 at that reviewed head and tree on
2026-08-20. Acceptance preserves these laws:

- observation capture is persist-first and exact evidence survives complete
  downstream or AI failure;
- recorded time is controlled by the database/server;
- occurred-time correction is append-only and effective occurred time is the
  unique supersession-chain leaf;
- capture idempotency is durable and World-scoped;
- actor and World authority are server-derived, while generic authenticated
  evidence-table writes remain denied;
- unsynced recovery is account-bound and cannot cross authenticated accounts;
- local recovery is not canonical evidence before server persistence;
- the two narrow authenticated `SECURITY DEFINER` RPCs are accepted only after
  explicit Tier H security review.

The production `public.rls_auto_enable()` execution grants must be remediated
before the first RealMe production migration. Audit metadata writer allow-list
enforcement remains deferred until an audit writer exists. Cleanup of the
obsolete unreleased `realme.observation.capture.v1` local-storage entry is
hygiene only and is not part of Step 99 acceptance.

The Warden later opened Step 100 through a separate bounded instruction on
2026-08-21. Step 99 remains accepted and unchanged.
