# Step 106 — Integrated Perceivable Experience

Status: **OPEN / IMPLEMENTATION CANDIDATE / NOT ACCEPTED**

Authorized base: `f2e5cf9add889776a1d743f89f449aefe78ded99`
Authorized base tree: `c60eabeffe14c145ff39a69c5d361d0c078c7fd1`

## Acceptance gate

> A user can complete the core RealMe loop through the product UI without bypassing admission authority, losing provenance, or confusing projections with canonical truth.

## Integration shape

Step 106 integrates the already accepted capabilities into one authenticated home experience instead of adding new canonical behavior.

The primary mobile navigation is expressed in product language:

1. Capture
2. Companion
3. Review
4. Today & Horizon
5. World

The same page also exposes a concise authority guide distinguishing:

- **You said** — saved observation/evidence, not interpretation;
- **RealMe interpreted** — unresolved candidate understanding, non-canonical;
- **You admitted** — canonical World understanding created only through explicit review authority;
- **Projected** — Today, Horizon and Living World, rebuildable from canonical state.

No roadmap-step terminology is required to use the authenticated product surface.

## Existing accepted boundaries reused

Step 106 reuses the accepted server-derived authority path in `src/app/page.tsx`:

- authentication is resolved server-side from Supabase claims;
- current World authority is obtained through `getCurrentWorld` and `SupabaseWorldAccessRepository`;
- observation history remains account-scoped and persist-first;
- interpretation reconciliation reuses the accepted durable pipeline boundary;
- candidate review uses the accepted Step 103 list/decision path;
- Today/Horizon use the accepted Step 104 read-only projection repository;
- Living World uses the accepted Step 105 read-only canonical projection path;
- temporal continuity remains governed by Step 100.

Step 106 introduces no client-supplied actor ID or World ID, no broad privileged RPC, no client-side canonical mutation path, and no AI-to-admission path.

## Interpretation and admission

The page never fabricates synchronous interpretation completion.

- With no observations, the product says there is nothing to interpret yet.
- With observations but no unresolved candidate, it says no review is ready and explicitly allows that durable interpretation may still be pending or may have produced no unresolved candidate.
- With unresolved candidates, it identifies review work as non-canonical and links the user to the existing review controls.

Accept/reject/correct/defer semantics remain implemented by the already accepted Candidate Review component. Only explicit user review can invoke admission.

## World understanding and projections

Admitted understanding is kept distinct from candidate state by the authority guide and section copy.

Today and Horizon are labelled as rebuildable operational projections derived from admitted facts plus authoritative time.

Living World is labelled as a disposable visual projection. The accepted renderer remains `living-world-code-v1`; it continues to show admitted Realm roots only at the current canonical boundary. Generic ontology relationships remain structurally inert, including strings such as `contains`. Sparse output is presented as truthful rather than cosmetically repaired.

## Empty and pending states

Step 106 preserves accepted empty-state behavior and adds integration copy around it:

- no observation: capture-first explanation;
- interpretation not exposed as ready: no-review-ready explanation without fabricated completion;
- no unresolved candidate: existing `Nothing waiting for review` state;
- no admitted Realm: existing `No admitted Realms yet` state;
- no Today items: existing Step 104 empty projection state;
- no Horizon items: existing Step 104 empty projection state.

No placeholder canonical entities, commitments or hierarchy are invented.

## Mobile

The authenticated page uses a small horizontally scrollable sticky core-loop navigation at narrow viewport widths and anchor targets with scroll margins. Essential navigation targets and existing interaction controls remain touch-sized.

A Step 106 E2E-only fixture is guarded by `REALME_E2E_FIXTURE=1`. Playwright exercises the integrated navigation at the canonical 390×844 mobile viewport and verifies reachability of capture, companion, review, Today/Horizon and Living World. Existing mobile E2E tests continue to exercise persist-first observation capture and companion behavior.

## Schema and production posture

Step 106 requires **no migration and no schema change**.

No SQL, migration, Drizzle artifact, RLS policy, dependency, environment, CI workflow or Netlify configuration is modified by the candidate.

Production remains untouched. Deferred production `public.rls_auto_enable()` remediation remains separately authorized work before the first production RealMe migration.

Step 107 remains **NOT STARTED / NOT AUTHORIZED**.
