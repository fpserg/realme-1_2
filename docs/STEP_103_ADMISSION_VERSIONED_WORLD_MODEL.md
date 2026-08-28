# Step 103 — Admission and Versioned World Model

Version: 0.1

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

### Defer

Defer records at most one durable deferral per user/candidate but is not a final
decision. It produces no canonical state and does not make the candidate false or
resolved. The candidate remains in the unresolved review list and may later be
accepted, corrected or rejected.

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
→ optional stable ontology node / alias
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

A proposition normally becomes one versioned assertion. When the candidate
already targets `proposed_subject_node_id`, admission reuses that stable node
identity. If the admitted predicate is `classification` and no canonical subject
node exists yet, explicit user admission may create one stable ontology node and
its initial alias from the admitted subject. This is the only Step 103 automatic
node creation path and it occurs inside explicit user admission, never in the AI
worker.

For an existing subject node, a newly admitted assertion with the same predicate
supersedes the prior active assertion. The previous row remains preserved with
its validity end and the successor retains `supersedes_assertion_id`. No hard
delete represents correction or reclassification.

`classification = Realm` is therefore incapable of becoming canonical without
an explicit user accept/correct action. No confidence threshold, repeated
mention or worker heuristic can bypass the same admission command. No fixed
hierarchy below Realm is introduced.

## Provenance

Every admitted assertion links directly to its admission decision. The decision
links to the immutable candidate, which links to the interpretation run and job.
Exact evidence is preserved both on the candidate and on the resulting assertion.
The action-specific audit event records candidate, interpretation run, decision,
created assertion, created node when applicable and superseded assertion when
applicable.

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
RLS remains enabled on the underlying accepted tables.

No generic canonical mutation function or privileged audit writer is added.

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

## Verification target

Before acceptance the implementation must prove at minimum:

1. candidate existence alone cannot create canonical state;
2. authenticated accept creates exactly one decision/assertion version;
3. replayed accept returns the same durable result;
4. reject and defer create no canonical state;
5. correction preserves the AI candidate and stores the corrected admitted value;
6. conflicting final actions converge safely through lock + uniqueness;
7. cross-World admission is denied;
8. Realm classification requires the explicit user decision path;
9. reclassification reuses stable node identity and supersedes without erasure;
10. admitted state remains traceable to candidate/run/evidence;
11. generic client table writes cannot bypass admission.

Steps 93–102 remain ACCEPTED + INTEGRATED. Step 103 remains an implementation
candidate until independently reviewed and explicitly accepted. Step 104 is NOT
STARTED.
