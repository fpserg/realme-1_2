# Step 106 — Integrated Perceivable Experience

Status: **OPEN / IMPLEMENTATION CORRECTION IN PROGRESS / NOT ACCEPTED**

Authorized base: `f2e5cf9add889776a1d743f89f449aefe78ded99`
Authorized base tree: `c60eabeffe14c145ff39a69c5d361d0c078c7fd1`

## Acceptance gate

> A user can complete the core RealMe loop through the product UI without bypassing admission authority, losing provenance, or confusing projections with canonical truth.

## Integrated experience

The authenticated `/` route remains the real product surface. Product-language navigation is:

1. Capture
2. Companion
3. Review
4. Today & Horizon
5. World

The authority distinction remains explicit:

- **You said** — persisted observation/evidence, not interpretation;
- **RealMe interpreted** — unresolved candidate, non-canonical;
- **You admitted** — current canonical World understanding created only through explicit review;
- **Projected** — Today, Horizon and Living World, rebuildable views rather than truth stores.

## Read-only canonical understanding

Step 106 now makes **You admitted** perceivable as an actual read-only product surface named **What RealMe knows**.

Its authority is the already accepted versioned World Model. The server derives the authenticated actor and current World, then `SupabaseCanonicalUnderstandingRepository` reads only World-scoped rows protected by the existing authenticated-member RLS policies:

- current `assertions` (`valid_to IS NULL`);
- active `ontology_aliases` for understandable subject labels;
- `admission_decisions` for explicit user-admission provenance;
- `assertion_evidence` and `source_fragments` for exact evidence lineage.

The primary surface shows current active assertions only. Superseded assertions cannot masquerade as current truth because `valid_to IS NULL` is mandatory. When the current assertion supersedes an earlier assertion, the superseded assertion ID remains available as secondary provenance.

For each current assertion the user can perceive:

- understandable subject label plus stable canonical subject identity;
- predicate;
- canonical scalar/object value;
- that the assertion is current admitted understanding;
- whether it came from accept or correct;
- admission timestamp and decision identity;
- source candidate identity;
- exact linked evidence fragments;
- assertion version identity and supersession link where present.

This surface is not an editor, generic canonical writer, hierarchy browser or Step 108 viewer. It has no mutation controls and does not grant structural authority to generic relationships.

## Admission refresh

`CandidateReview` continues to use the accepted `/api/admission/decision` path. After any successful decision it calls the normal Next.js `router.refresh()` mechanism. For truth-changing **Accept** and **Correct**, that causes the authoritative server reads for candidate review, current canonical understanding, Today/Horizon and Living World to run again. No parallel client-side canonical model is constructed.

Reject and Defer retain their accepted semantics. A refresh after them is permitted for consistency but does not represent either action as canonical admission.

## Interpretation semantics

The integrated UI still does not infer worker completion from candidate absence:

- no observations → nothing to interpret yet;
- observations but no unresolved candidate → review is not ready; durable interpretation may still be pending or may have produced no unresolved candidate;
- unresolved candidates → clearly non-canonical review work.

## Projections

Today and Horizon remain read-only Step 104 projections derived from admitted facts plus authoritative Step 100 time.

Living World remains `living-world-code-v1`, computed/disposable and Realm-root-only under current canonical semantics. Generic ontology relationships have zero structural authority, including a predicate string named `contains`. The canonical-understanding surface is never used to fabricate hierarchy.

## Stateful mobile evidence

The environment-gated `/e2e-integrated` fixture reuses the real `HomeView`, `CandidateReview`, canonical-understanding component and Living World component. Its test-only admission endpoint is available only with `REALME_E2E_FIXTURE=1`; it exists solely to prove `router.refresh()` causes a new server render in CI without replacing the normal authenticated data path.

At the accepted 390×844 viewport the fixture exposes a non-empty candidate with usable Accept, Reject, Correct and Defer controls. It proves without manual reload that:

- admitting a Realm classification removes the candidate, makes the canonical fact visible and makes the Realm visible through Living World;
- admitting a non-Realm/non-commitment assertion removes the candidate and makes that fact visible in **What RealMe knows**, while it remains absent from Living World and operational projections.

Existing Step 104 repository regression coverage continues to prove Today/Horizon derive from the accepted canonical commitment path; Step 106 does not fabricate a new commitment semantic merely for this correction.

## Security and schema posture

Actor identity and World authority remain server-derived. World isolation remains fail-closed. No client-controlled authority, service-role exposure, broad privileged RPC, RLS weakening, AI admission path or generic canonical write API is introduced.

Step 106 requires **no schema change and no migration**. Production remains untouched. Deferred production `public.rls_auto_enable()` remediation remains separately authorized work.

Step 107 remains **NOT STARTED / NOT AUTHORIZED**.
