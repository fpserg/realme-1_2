# Step 107 — Sergey Pilot Migration

Status: **OPEN / CORRECTED IMPLEMENTATION CANDIDATE / NOT ACCEPTED**

Authorized base: `02a2d813c5555ad27ead319993cc1f5402dc6a6d`  
Base tree: `f1dff960fe103eedd8ff12acca8b802ca25cd010`

Pinned continuity source:

- repository: `fpserg/RealMe`;
- commit: `b701e303e0e716dd54099938fab092d419d30e61`;
- tree: `b5b3edd5d31cc1a4955a493ad0d9dd8948550d88`.

## Outcome under review

Step 107 adds bounded, disposable operational tooling for the Sergey pilot. It does not add a migration schema, a generic import product, a new authority class or an alternate canonical-write path.

The migration chain remains:

```text
historical source
→ observation + exact source fragment
→ Step 102 interpretation candidate
→ explicit Step 103 user admission
→ versioned World Model
→ Step 104 / Step 105 projections
```

The importer itself has zero admission authority.

## Source authority classes

The pinned manifest preserves the Architect-approved classes without flattening them:

- **A** — verbatim Living Input;
- **B** — derived factual operational evidence;
- **C** — accepted historical product / ontology decision evidence;
- **D** — derived interpretation input only;
- **E** — presentation-only evidence, excluded from evidence import and carrying zero canonical authority.

The representative rehearsal manifest contains two whole-file Living Inputs, one OR anchor, one accepted World-decision anchor, one WBTD interpretation anchor and one excluded presentation-only anchor.

The daily `LI.md` source format does not contain a provable delimiter between individual historical submissions. Step 107 therefore preserves each selected LI file as one whole-file observation. It never heuristically splits prose.

## Cryptographically pinned source bytes

The executable path no longer reads evidence from mutable working-tree files.

Before an executable plan is produced, the runner now:

1. proves the supplied source root is a Git repository;
2. resolves the manifest's exact `sourceCommit` as a commit object;
3. resolves that commit's root tree and requires exact equality with `sourceTree`;
4. resolves every selected `sourceCommit:path` to its Git object ID;
5. requires exact equality with the manifest's per-item `blobSha`;
6. requires the object to be a Git blob;
7. reads the evidence bytes directly with `git cat-file blob <verified-sha>`.

There is no working-tree fallback. Manifest provenance is copied into the import plan only after all Git pins have been independently resolved and verified.

Automated regressions cover wrong blob SHA, absent pinned commit, tree mismatch, missing pinned path, missing blob object, and a dirty working tree whose bytes differ from the pinned commit. The dirty-worktree happy path proves that the committed historical blob bytes are used instead.

## Provenance and deterministic replay

Every included source item is pinned by repository, commit, source path and Git blob SHA. Exact-text selections must occur exactly once. Whole-file selections preserve the full source file.

The planner calculates SHA-256 content fingerprints and deterministic UUIDs from the pinned source locator for:

- observation identity;
- source-fragment identity;
- capture idempotency identity.

The supported executor accepts only a server-derived World and its owning account. It writes only `observations` and `source_fragments`, uses deterministic IDs, and validates that any replayed rows match the source plan exactly. It contains no canonical table write.

## Atomic evidence execution

`scripts/run-step-107-sergey-pilot.mjs --execute` is the only supported evidence execution path.

The runner uses the existing `postgres` dependency to open one explicit PostgreSQL transaction. Inside that transaction it:

1. sets the Step 107 executor guard, World ID and account ID with transaction-local `set_config(..., true)`;
2. creates and populates the temporary source-plan table;
3. executes the ownership check;
4. writes observations;
5. writes source fragments;
6. performs full persisted-row replay verification;
7. commits only after every check succeeds.

`scripts/step-107-import-evidence.sql` is an internal transaction body and fails immediately unless the transaction-local executor guard is present. Operators are not expected to remember `BEGIN`, and direct/autocommit execution is unsupported.

Any ownership, write or replay mismatch rejects the transaction. No observation or source fragment introduced by the failed attempt survives.

## Temporal treatment

Historical source operational day is stored separately as `local_calendar_date` when the source establishes that day.

`occurred_at` remains `NULL` when the source does not establish an authoritative physical instant. Such evidence remains `occurred_precision = 'unknown'` and Step 107 does not invoke Step 100 assignment merely to force it into an import-time operational period.

Exact physical timestamps are preserved only when supplied by source material; automated tests cover exact timestamp preservation and rejection of fabricated date-only instants.

## Identity treatment

Historical identifiers are source identities only. The planner supports deterministic explicit source→native mappings and fails closed if one source identity maps to multiple native IDs. Normalized-label collisions are reported as ambiguities rather than merged.

The staging rehearsal additionally exercised native Step 103 identity reuse with two independently evidenced Stronghold candidates. The second admission reused the first Stronghold node and produced an assertion successor rather than a duplicate ontology node.

## Production security prerequisite

Before any RealMe production migration, the authorized privilege-only remediation was applied to existing production helper `public.rls_auto_enable()`:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated, service_role;
```

No function body, owner, `SECURITY DEFINER` property, `search_path`, event trigger, trigger owner, trigger enabled state, tags or automatic-RLS behavior was changed. Production RealMe migrations remain unapplied and production pilot data remains absent.

## Staging catch-up

Staging was advanced from Step 102 through the already accepted migrations only:

- `20260828104500_step_103_admission_versioned_world_model`;
- `20260829195000_step_104_commitments_operational_projections`.

No Step 107 schema migration exists.

## Representative staging rehearsal

The rehearsal used a staging-only pilot Auth identity created through the existing `auth.users` bootstrap trigger, which produced the normal account, one World, owner membership and initial companion.

Imported evidence:

- 5 observations;
- 5 exact source fragments;
- class counts: A = 2, B = 1, C = 1, D = 1;
- class E excluded = 1 (`presentation_only_zero_canonical_authority`).

All five imported observations retain `occurred_at = NULL`. Four retain their source operational-day date; the accepted World decision has no operational-day claim. No operational-period membership was manufactured for this uncertain historical evidence.

All five observations were enqueued through accepted `enqueue_observation_interpretation`, producing five durable Step 102 jobs. The bounded staging worker fixture produced four fully provenance-linked candidate interpretations; one WBTD-derived RealMe roadmap candidate intentionally remains unresolved and non-canonical.

Three candidates were explicitly admitted through native `decide_candidate` user authority in staging:

1. Stronghold → `classification` → `Domain` from the first LI;
2. Stronghold → `classification` → `Domain` from the second LI;
3. Household → `classification` → `Realm` from the accepted historical World decision.

The two Stronghold admissions created one stable node and two assertion versions, with the second superseding the first. Household created one separate stable node and current Realm assertion.

No WBTD conclusion became canonical merely through import.

## Reconciliation

First-run authority-layer counts for the pilot World after the bounded interpretation/admission fixture:

- observations: 5;
- source fragments: 5;
- durable jobs: 5;
- interpretation runs: 4;
- candidate claims: 4;
- admission decisions: 3;
- ontology nodes: 2;
- active aliases: 2;
- assertion versions: 3;
- assertion evidence links: 3;
- operational-period memberships: 0;
- unresolved candidates: 1.

The canonical fingerprint over admission decisions, ontology nodes, aliases and assertions is:

`de28c976402e3bf0809687dc633e716ed54858533f7de80bbd57643af6f36413`

A rollback-only `CREATE OR REPLACE VIEW` rebuild of the Step 104 commitment projection produced the same canonical fingerprint before and after. The pilot has zero commitment projection rows and exactly one current admitted Realm root, so Today/Horizon remain empty and the Living World source contains Household only. Stronghold's admitted `Domain` classification does not invent a structural relationship beneath Household.

An identical evidence/enqueue replay produced zero count delta in observations, fragments, jobs, interpretation runs, candidate claims, ontology nodes or assertions. Replaying all three final admissions returned the existing decisions/assertions with `was_replay = true`.

## Inspector correction staging regression

After the atomicity correction, staging was exercised with a real PostgreSQL replay conflict designed to fail only after a new observation would have been written and a source-fragment ID collided with an existing fragment.

Before the attempt:

- observations: 5;
- source fragments: 5;
- observation-row fingerprint: `a73d45079359dcc497b2bebb115307b6`;
- source-fragment-row fingerprint: `7ed0ab2f470f9b3ee7730187d0bea34c`.

Replay verification raised `Step 107 replay mismatch: persisted evidence differs from pinned source plan.` The transaction rolled back.

After the failed attempt:

- observations: 5;
- source fragments: 5;
- observation-row fingerprint: `a73d45079359dcc497b2bebb115307b6`;
- source-fragment-row fingerprint: `7ed0ab2f470f9b3ee7730187d0bea34c`;
- deliberately attempted observation `99999999-9999-4999-8999-999999999991`: absent.

An immediately following identical replay of the existing five evidence rows completed successfully and left the observation count at 5.

The regression changed no schema and left the representative pilot reconciliation state intact.

## Scope boundary

Step 107 does not authorize or implement:

- production RealMe migrations;
- production Auth or Sergey data mutation;
- direct historical canonical bootstrap;
- generic multi-user import UX;
- fuzzy identity matching, embeddings or confidence merging;
- new structural hierarchy semantics;
- Step 108.

Step 107 remains **OPEN / CORRECTED IMPLEMENTATION CANDIDATE / NOT ACCEPTED** pending independent Inspector re-review and Warden acceptance. Step 108 remains unauthorized.
