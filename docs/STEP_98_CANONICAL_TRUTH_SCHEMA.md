# RealMe 1.2 — Step 98 Canonical Truth Schema

Version: 1.0

Status: ACCEPTED — STEP 98 COMPLETE

Opened by: Warden

Opened on: 2026-08-20

Defaults accepted by: Warden

Defaults accepted on: 2026-08-20

Accepted by: Warden

Accepted on: 2026-08-20

## 1. Bounded outcome

Step 98 introduces the first constitutional truth schema beneath the accepted
Step 97 identity and World-ownership foundation.

The accepted schema makes these durable layers structurally different:

```text
observation and exact source evidence
  → interpretation run and candidate claim
    → admission decision
      → versioned ontology identity, relationship or assertion
```

It also introduces the minimum temporal, attachment, durable-job and audit
records required by the accepted roadmap.

Step 98 does not provide:

- a capture command or observation input interface;
- an AI provider, prompt or model integration;
- a background worker or queue consumer;
- an admission interface or canonical mutation command;
- Today, Horizon or another operational projection;
- generated illustration or Living World behavior;
- personal data, legacy runtime seed or conversation archives;
- a production migration or production release.

## 2. Migration identity

The accepted schema migration is:

`20260820095459_step_98_canonical_truth_schema`

Its explicit internal-access hardening migration is:

`20260820095634_step_98_internal_table_denials`

Its canonical admission-invariant migration is:

`20260820100146_step_98_admission_invariants`

Its forward-only Code Review correction migration is:

`20260820143800_step_98_correction_invariants`

The three earlier Step 98 migration identities remain unchanged because they
were already recorded in synthetic staging. The correction migration narrows
admission authority, canonical JSON values, temporal correction chains and job
states without rewriting deployed history.

The SQL migration, Drizzle journal and Drizzle snapshot carry the same
timestamp identity. Drizzle reads the single schema entry point
`src/infrastructure/db/schema/index.ts`; this prevents module re-exports from
being interpreted as duplicate schema declarations.

The generated relational migration is augmented intentionally with:

- World-matching composite foreign keys for every supersession chain;
- comments recording constitutional meaning;
- explicit RLS enablement, grants and policies.

`pnpm db:check` is now part of both `pnpm check` and CI. An automated migration
test independently checks the journal tag, prior snapshot identity, expected
table inventory and constitutional SQL additions.

## 3. Evidence boundary

### `observations`

An observation is the stable recorded envelope. It belongs to one World and
keeps recorded time separate from optional occurred time, source timezone and
local calendar date.

It records source provenance through a non-empty source kind and optional
source locator. It contains no admitted interpretation, ontology assignment or
projection state.

### `source_fragments`

An observation may own multiple ordered source fragments. Each fragment keeps:

- exact text;
- its order within the observation;
- an integrity hash;
- capture time.

Exact source text is not corrected in place.

### `observation_corrections`

Corrections are append-only records for occurred time, occurrence precision,
source timezone or local calendar date. A later correction may supersede an
earlier correction inside the same World. Neither action mutates the original
observation or source fragments.

### `attachments`

Attachments contain provenance and private-object metadata only: bucket,
object key, media type, size, integrity hash and optional original filename.
Step 98 does not create a Storage bucket or upload workflow.

## 4. Interpretation boundary

### `interpretation_runs`

Runs record non-canonical processing provenance, including status, provider and
model identifiers when later available, prompt version, schema version, input
hash and timing. The schema does not authorize any provider integration.

### `candidate_claims`

Candidate claims belong to one interpretation run. Their payload is
non-canonical structured JSON. A candidate may remain hidden, unresolved or
rejected indefinitely; its existence never changes the World Model.

When a candidate proposes an existing subject node, a World-matching foreign
key prevents it from naming a node in another World.

### `candidate_claim_evidence`

Candidate claims link explicitly to exact source fragments within the same
World. Mention frequency is not modeled as structural truth.

## 5. Admission boundary

### `admission_decisions`

Admission decisions are append-only accept, reject, correct or defer records.
Step 98 permits user authority only, and every decision must name an account
that is a member of the same World. Policy-backed admission is deferred until
durable policy identity, version, provenance and governance exist.

A correcting decision requires a JSON-object correction payload. Accept,
reject and defer decisions prohibit correction payloads. A superseding decision
must concern the same World and candidate as its predecessor.

AI is not an admission authority. Step 98 creates no path by which provider
output can insert or mutate admitted state.

Correction payloads remain distinct from the original candidate. Decisions may
supersede earlier decisions only inside the same World.

## 6. Versioned World Model

### `ontology_nodes`

A node stores only:

- stable UUID identity;
- World ownership;
- the admission decision that created it;
- creation time.

It has no name, rank, tier, parent, Realm count, Domain, Locus, role, image,
status or visual form. Realm classification and every personal structural
interpretation must therefore arrive through an admitted assertion rather than
through a fixed hierarchy column.

### `ontology_aliases`

Aliases are versioned, validity-bounded and decision-backed. Renaming or
reclassification does not replace node identity.

### `ontology_relationships`

Relationships use admitted predicates between stable nodes. They support
arbitrary depth without imposing a mandatory second tier. Corrections create a
new relationship version and preserve the superseded record.

### `assertions`

Assertions represent admitted versioned understanding. An assertion may apply
to the World as a whole or to a stable node, and has exactly one object: either
another stable node or a literal string, number or boolean value. JSON objects
and arrays are not canonical assertion values. It records validity separately
from record creation and may supersede an earlier assertion inside the same
World.

### `assertion_evidence`

Admitted assertions retain exact source-fragment evidence independently of the
candidate that proposed them.

## 7. Temporal boundary

### `time_settings`

Time settings are versioned and prospective. They separate IANA timezone from
the local operational-day boundary. The database default is the accepted
`04:00` local boundary.

### `operational_periods`

An operational period stores physical start/end instants, a local date and the
exact time-setting version from which it was derived.

### `observation_operational_period_memberships`

Operational membership is an explicit append-only assignment. A correction
supersedes a prior membership rather than rewriting it, so changing the
boundary cannot silently move historical observations.

Each observation has at most one initial membership. Corrections require a
predecessor for the same World and observation, and one predecessor may have at
most one direct successor. These constraints preserve a single append-only
correction chain rather than a forked or detached history.

### Reflection periods

`reflection_periods` and
`observation_reflection_period_memberships` keep reflective review windows
separate from both physical chronology and operational-day membership.

Step 100 remains responsible for calculating periods and effective temporal
state. Step 98 supplies only the durable identities and constraints.

## 8. Jobs and audit

`jobs` defines durable status, idempotency, retry and failure fields, but no
worker or AI task is implemented. Step 102 remains responsible for job
execution and delivery semantics. Attempts remain between zero and the retry
limit; queued jobs are unlocked and retain retry capacity; running jobs are
locked and have begun an attempt; every non-running state is unlocked.

`audit_events` is an append-only metadata record for security-sensitive and
canonical commands. A user actor must be a member of the same World. Audit
metadata must not contain secrets or unnecessary personal content.
Future writers must validate metadata through a strict action-specific
allow-list; arbitrary caller-provided metadata is not permitted.

## 9. Authorization law

- Every Step 98 table has a non-null `world_id`.
- Cross-record and evidence links use World-matching composite foreign keys.
- Actor references require membership in the affected World.
- Supersession links cannot cross Worlds.
- RLS is enabled explicitly on all 20 Step 98 tables.
- Anonymous and authenticated roles are revoked from every Step 98 table before
  narrowly scoped grants are applied.
- Authenticated users receive World-scoped read access only to user-owned
  evidence, decisions, admitted World Model and temporal records.
- Interpretation runs, unresolved candidates, jobs and audit events remain
  inaccessible through the public client API.
- Authenticated users receive no insert, update or delete grant on any Step 98
  table.
- Application commands and their exact write grants remain deferred to the
  steps that implement them.

RLS is defense in depth. It does not replace application-layer authorization,
validation or admission policy.

## 10. Deletion and history

Internal evidence, interpretation, decision, ontology and supersession links
use restrictive deletion behavior. Ordinary correction is append-only.

Rows remain rooted in a World for future user-directed sovereignty. Step 109
must design and verify an explicit whole-World export/deletion procedure; Step
98 does not expose deletion privileges or claim that incidental cascading is a
complete sovereignty workflow.

## 11. Required acceptance verification

Before acceptance, the candidate had to:

1. pass formatting, ESLint, strict TypeScript, architecture checks,
   `pnpm db:check`, all unit/enforcement tests and a production build;
2. pass the mobile Chromium smoke test;
3. apply the exact migration to RealMe Staging only;
4. verify all 24 product tables have RLS enabled;
5. verify grants and policies match this record;
6. exercise a complete synthetic observation → candidate → decision →
   assertion chain and prove each layer retains a distinct identity;
7. prove cross-World evidence, actor and supersession links are rejected;
8. prove authenticated direct writes remain denied;
9. clean all synthetic records and users from staging;
10. verify production still contains zero RealMe migrations, tables and users;
11. run Supabase security advisors;
12. obtain exact-head independent Code Review and explicit Warden acceptance.

## 12. Acceptance verification record

Verified on 2026-08-20 against `RealMe Staging`:

- the remote migration identities exactly match the repository schema and
  internal-denial migrations;
- all 24 product tables exist, all have RLS enabled and all contain zero rows;
- the 20 Step 98 tables expose zero anonymous grants and zero authenticated
  insert, update or delete grants;
- 20 explicit policies exist: 15 ownership-scoped read policies and five
  deny-all policies for internal records;
- all eight World-matching supersession constraints exist;
- `ontology_nodes` contains exactly `id`, `world_id`,
  `admitted_by_decision_id` and `created_at`;
- Supabase security advisors report zero findings;
- a rollback-only synthetic flow created separate observation, source fragment,
  interpretation run, candidate claim, evidence, admission decision, ontology
  node, assertion and assertion-evidence identities;
- the synthetic candidate produced no assertion before admission;
- a rejected decision was prevented from creating an ontology node while an
  accepting decision created exactly one node;
- cross-World evidence, decision-actor and supersession attempts were rejected
  by foreign keys;
- an authenticated synthetic member could read exactly its own observation,
  could not see the other synthetic World, could not insert directly and could
  not read hidden candidate claims;
- both verification transactions rolled back, leaving zero Auth users and zero
  product rows.

Read-only production verification found zero RealMe migrations, zero public
product tables and zero Auth users. Production was not modified.

Local `pnpm check` passed formatting, ESLint, strict TypeScript, architecture
enforcement, Drizzle consistency, all tests and the production build before the
final migration reconciliation. The local mobile test could not run because
the isolated workspace lacked Chromium and its CDN returned a zero-byte archive
when installation was attempted. TLS or download validation was not weakened;
the exact-head GitHub Actions mobile Chromium result remains required before
acceptance.

### Code Review correction verification

Independent Code Review requested correction of the candidate at head
`20302213d1f5e36e37285b0ca3551295bca9ba6c`. The correction was applied
forward-only to RealMe Staging as
`20260820143800_step_98_correction_invariants`; the three earlier Step 98
migration identities were not rewritten.

The repository carries a reusable rollback-only regression script covering 18
malformed states. Staging rejected actorless and policy admissions, incoherent
decision payloads, cross-candidate decision supersession, a cross-World
candidate-node reference, canonical object and array JSON, detached, duplicate,
forked and cross-observation operational memberships, attempts beyond the retry
limit and inconsistent job lock/status combinations.

After rollback-only verification:

- all 11 correction constraints and five supporting indexes were present;
- all 24 product tables remained RLS-enabled;
- anonymous and authenticated client-write grants remained absent;
- staging contained zero Auth users and zero product rows;
- Supabase security advisors reported zero findings;
- production still contained zero RealMe migrations, zero public product tables
  and zero Auth users.

Exact-head GitHub Actions run 75 and the Netlify Deploy Preview both succeeded
after the correction was committed and published.

## 13. Known external production finding

Read-only opening inspection found that the otherwise empty production
Supabase project contains the official-example `public.rls_auto_enable()` event
trigger function with `EXECUTE` still granted to `anon` and `authenticated`.
Current Supabase advisors report two warnings for those grants.

This function predates RealMe migrations, production has no product tables or
users, and Step 98 does not modify it. It did not reopen Step 97 or block Step
98 acceptance. Its unsafe execution grants must be remediated before the first
RealMe production migration.

## 14. Acceptance record and boundary

Independent Code Review returned `APPROVE` for exact head
`b1d9a179656e9dd365c200ab505b6e862aadf785`, tree
`02d61198130a07f87416b59a76c86083b66f1252`, against base/main
`e64464c52b30c75495fa5894a08c6f92825ae4fe`. GitHub Actions run 75 passed,
including Drizzle verification, the production build and mobile Chromium.

The Warden explicitly accepted Step 98 at that exact reviewed head and tree on
2026-08-20. Acceptance freezes the schema boundary described in this record.

The pre-existing production `public.rls_auto_enable()` execution warnings must
be remediated before the first RealMe production migration. Strict metadata
allow-list enforcement remains deferred until an audit writer exists.

Step 98 acceptance does not authorize Step 99, AI processing, a production
migration, personal-data import or Living World generation. The Warden later
opened Step 99 through a separate bounded instruction on 2026-08-20; that action
does not reopen or broaden accepted Step 98.
