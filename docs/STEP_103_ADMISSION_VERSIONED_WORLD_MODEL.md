# Step 103 — Admission and Versioned World Model

Version: 0.2

Status: OPEN — IMPLEMENTATION CANDIDATE / NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-28

Step 104: NOT STARTED

Risk: Tier H

Forward migration:
`20260828104500_step_103_admission_versioned_world_model`

## Outcome and gate

Step 103 activates the accepted Step 98 admission and World Model structures
through a narrow user-authorized command boundary. AI candidates remain
immutable non-canonical interpretation output. Only an authenticated user's
explicit accept or correct action can produce canonical state.

Acceptance gate:

> No AI-generated interpretation becomes canonical without passing admission
> policy.

Step 103 is not accepted until independent Inspector review, exact-head CI,
preview and bounded staging verification are complete and the Warden explicitly
accepts it.

## Admission authority

The user is the only admission authority in Step 103. `admission_decisions`
continues to enforce `authority_kind = 'user'` and a non-null admitting account.
The Step 103 command derives the actor from `auth.uid()` and validates ownership
of the candidate's World. Browser input cannot choose actor, World, provider,
model, run or canonical ownership.

Policy-backed or autonomous admission is not implemented. The Step 102 worker
retains no admission or canonical mutation path.

## Review surface

Authenticated users receive the smallest useful review card for unresolved
candidates in Worlds they own. A card shows:

- proposed subject, predicate and literal value;
- the model explanation;
- exact source-fragment evidence text;
- the durable consequence of accepting;
- accept, reject, correct and defer controls.

The review RPC does not expose worker lock tokens, job internals, provider
secrets or privileged pipeline state. Candidate, run and evidence identifiers
remain server-side except for the immutable candidate identifier required by the
narrow decision command and source-fragment identifiers used only as stable UI
keys/provenance references.

## Decision semantics

### Accept

Accept records one immutable user admission decision for the exact candidate.
The canonical assertion is created in the same database transaction and links
back to that admission decision. Candidate evidence is copied into
`assertion_evidence`; the original candidate and interpretation run are not
modified.

### Reject

Reject records a durable user decision and an action-specific audit event. It
creates no ontology node, alias, relationship or assertion. The rejected
candidate and its evidence remain historical interpretation evidence.

### Correct

Correction never rewrites the AI candidate. The command accepts a strict
corrected durable payload containing exactly `subject`, `predicate` and one
literal `object`. The original candidate remains immutable, the correction is
stored on the admission decision and the resulting canonical assertion records
the corrected value.

The correction UI preserves scalar semantics rather than serializing all values
as text. An unchanged number remains a number and an unchanged boolean remains a
boolean when another field is edited. Edited numeric values are parsed only as
finite numbers; booleans use an explicit true/false control; strings remain
strings. The UI exposes only these three authorized scalar kinds, not arbitrary
JSON.

### Defer

Defer records at most one durable deferral per user/candidate but is not a final
decision. It produces no canonical state and does not make the candidate false or
resolved. The candidate remains in the unresolved review list and may later be
accepted, corrected or rejected.

## Server-authoritative subject identity

Entity identity is resolved at the admission boundary. Step 102 is not required
to emit or know canonical database UUIDs.

For the textual subject being admitted, `decide_candidate()` applies a
conservative same-World policy over active canonical aliases. Normalization is
deterministic: trim outer whitespace, collapse whitespace runs, and compare
case-insensitively. No fuzzy matching, embeddings, confidence threshold or AI
identity merge is used.

The resolution law is:

1. derive candidate and World from database state;
2. derive admitted textual subject from the candidate or corrected payload;
3. if `proposed_subject_node_id` is present, verify the node exists in that
   World and has a compatible active canonical alias for the admitted subject;
4. otherwise resolve the normalized subject against active aliases in the same
   World;
5. exactly one matching node binds the assertion to that stable identity;
6. multiple matching nodes fail as identity-ambiguous rather than guessing;
7. no matching node may create one stable node + initial alias only for an
   explicitly admitted `classification` proposition;
8. no matching node for an ordinary entity proposition fails as
   identity-unresolved rather than falling back to a World-level assertion.

Cross-World nodes and aliases never participate in identity resolution. A null
`subject_node_id` therefore cannot silently represent failed entity resolution;
its accepted Step 98 meaning remains reserved for genuinely World-level
propositions.

First discovery is also serialized inside PostgreSQL across different candidate
rows. Before any proposed-node validation or alias lookup, the command acquires
a transaction-scoped advisory lock derived from the candidate World ID plus the
normalized admitted subject. After the lock is acquired it performs the same-World
active-alias lookup, so concurrent first classifications of the same normalized
subject can create at most one stable identity; the later transaction reuses the
committed identity (or safely retries after a deterministic database failure).
The lock key is never exposed outside the admission transaction.

This closes the real Step 102 → Step 103 path where current candidates normally
carry `proposed_subject_node_id = NULL`. A first admitted `Football →
classification → Domain` may create one stable Football node and alias. A later
Step 102-shaped `Football → classification → Realm`, also with a null proposed
node ID, resolves through that canonical alias and reuses the same node.

## Transactionality, replay and concurrency

The candidate row is locked before a decision is evaluated. A partial unique
index permits at most one final `accept`, `reject` or `correct` decision per
World/candidate. Identical final replay returns the existing durable decision
and canonical result. A different final action, or a corrected replay with a
different payload, fails deterministically.

The accepting/correcting transition is one PostgreSQL transaction:

```text
candidate lock
→ immutable admission decision
→ server-authoritative subject resolution
→ optional stable ontology node / alias for first classification
→ prior assertion version closure when applicable
→ successor assertion
→ exact assertion evidence
→ action-specific audit event
```

A failure rolls back the entire transition. Duplicate taps, retries and stale
clients therefore cannot create duplicate final decisions, assertion versions
or ontology identities for one logical admission.

## Versioned World Model

The accepted Step 98 canonical tables remain the model. Step 103 adds no
parallel mutable candidate or World Model store.

A proposition becomes one versioned assertion only after its subject identity is
lawfully resolved or, for a first explicitly admitted classification, created in
the same transaction. The Step 98 `proposed_subject_node_id` field remains
supported but is never treated as a browser- or AI-trusted capability.

For an existing subject node, a newly admitted assertion with the same predicate
supersedes the prior active assertion. The previous row remains preserved with
its validity end and the successor retains `supersedes_assertion_id`. Immediate
supersession uses the greater of real clock time and predecessor `valid_from + 1
microsecond`, preserving the accepted strict validity interval without overlap
or zero-length history. Replay does not advance the boundary again.

`classification = Realm` is therefore incapable of becoming canonical without
an explicit user accept/correct action. No confidence threshold, repeated
mention or worker heuristic can bypass the same admission command. No fixed
hierarchy below Realm is introduced.

## Provenance

Every admitted assertion links directly to its admission decision. The decision
links to the immutable candidate, which links to the interpretation run and job.
Exact evidence is preserved both on the candidate and on the resulting assertion.
The action-specific audit event records candidate, interpretation run, decision,
resolved subject identity, created assertion, created node when applicable and
superseded assertion when applicable.

A corrected admission additionally preserves the exact corrected payload on the
decision. This provides a queryable route from canonical state back to user,
candidate, run/model/prompt/schema/input provenance and exact source fragments.

## Access and privilege boundary

Step 103 exposes exactly two new authenticated RPC capabilities:

- `list_candidate_reviews()` — read-only unresolved review projection;
- `decide_candidate(candidate, action, correction)` — action-specific admission.

Both are `SECURITY DEFINER`, use `SET search_path = ''`, schema-qualify every
relation and explicitly revoke default execution before granting only to
`authenticated`. Direct client insert/update/delete grants on admission and
canonical World Model tables are explicitly revoked again as defense in depth.
RLS remains enabled on the underlying accepted tables. Step 102 hidden worker and
candidate pipeline tables remain unavailable to generic clients.

No generic canonical mutation function or privileged audit writer is added.

## Drizzle migration continuity

Step 103 is the thirteenth forward SQL migration. The accepted first twelve SQL
migration identities and their ordering are unchanged. The Drizzle journal now
contains the Step 103 tag exactly once at index 12, and
`20260828104500_snapshot.json` has its own snapshot ID with `prevId` pointing to
the accepted Step 102 snapshot ID. The custom migration changes admission
indexes/functions/privileges over the accepted schema; it does not introduce a
parallel table model.

## Scope exclusions

Step 103 does not implement:

- Step 104 commitments, Today/Horizon projection work or projection rebuilds;
- notifications or reminders;
- Living World rendering or generated illustration;
- autonomous/policy admission;
- companion-triggered canonical mutation;
- production rollout;
- broader conversation archiving;
- Step 102 candidate-generation changes.

Production `public.rls_auto_enable()` execution-grant remediation remains
mandatory before the first RealMe production migration and is not part of Step 103.

## Verification evidence before Inspector re-review

Rollback-only synthetic staging verification exercised real Step 102-shaped
candidates with `proposed_subject_node_id = NULL`. It demonstrated:

1. candidate existence alone creates no canonical state;
2. first Football classification creates exactly one stable identity;
3. later Football reclassification resolves through the canonical alias to the
   same identity, preserves the prior Domain version and activates Realm;
4. predecessor `valid_to` equals successor `valid_from`, remains strictly after
   predecessor `valid_from`, and replay creates no extra node/version;
5. an ordinary known-entity proposition binds to the existing Football node;
6. unresolved and ambiguous entity subjects fail with no canonical mutation;
7. an alias in another World cannot satisfy identity resolution;
8. duplicate accept converges, reject and defer remain non-canonical, defer
   remains reviewable, and conflicting final decisions are denied;
9. correction preserves the immutable candidate and stores the exact corrected
   admitted payload;
10. exact source fragments and interpretation-run provenance survive admission;
11. generic authenticated canonical writes and Step 102 hidden-table access are
    denied;
12. the two Step 103 RPCs remain the only new authenticated `SECURITY DEFINER`
    surface and both retain empty search paths.

The rollback returned staging to the accepted 12-migration baseline with 0 Auth
users, 0 accounts, 0 Worlds, 24/24 public product tables retaining RLS and no
synthetic admission/canonical rows. Production remains unmigrated and untouched.
The four files identified by the repository formatter have now been normalized
with the normal Prettier configuration and no temporary formatter workflow
remains. Exact-head CI and deploy-preview evidence are still required before this
candidate is handed back for independent Inspector review.

Steps 93–102 remain ACCEPTED + INTEGRATED. Step 103 remains OPEN /
IMPLEMENTATION CANDIDATE / NOT ACCEPTED until independently reviewed and
explicitly accepted. Step 104 is NOT STARTED.
