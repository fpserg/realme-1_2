# Step 107 — Sergey Pilot Migration

Status: **OPEN / PRODUCTION EVIDENCE IMPORT COMPLETE / INTERPRETATION NOT YET AUTHORIZED / NOT ACCEPTED**

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

The executable path does not read evidence from mutable working-tree files.

Before an executable plan is produced, the runner:

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

The executor writes only `observations` and `source_fragments`, uses deterministic IDs, and validates that any replayed rows match the source plan exactly. It contains no canonical table write.

## Direct PostgreSQL atomic evidence execution

The original direct PostgreSQL path remains intact:

```text
scripts/run-step-107-sergey-pilot.mjs --execute
```

It requires `DATABASE_URL`, a World ID and owning account ID. The existing `postgres` dependency opens one explicit PostgreSQL transaction. Inside that transaction the runner:

1. sets the Step 107 executor guard, World ID and account ID with transaction-local `set_config(..., true)`;
2. creates and populates the temporary source-plan table;
3. executes the ownership check;
4. writes observations;
5. writes source fragments;
6. performs full persisted-row replay verification;
7. commits only after every check succeeds.

`scripts/step-107-import-evidence.sql` remains the internal transaction body for this direct path and fails immediately unless the transaction-local executor guard is present. Any ownership, write or replay mismatch rejects the transaction. No observation or source fragment introduced by a failed attempt survives.

## Additive Supabase control-plane execution transport

Step 107 also provides an additive preparation mode for environments where direct PostgreSQL credentials/socket connectivity are unavailable:

```text
scripts/run-step-107-sergey-pilot.mjs --control-plane-sql \
  --source-root=/path/to/RealMe \
  --world-id=<expected-world-uuid> \
  --account-id=<expected-account-uuid>
```

This mode performs the same pinned-Git validation and deterministic plan construction but **does not connect to or write a database**. It emits one deterministic SQL artifact for operator submission through the privileged Supabase control-plane `execute_sql` operation.

The control-plane law is strict:

- exactly one PostgreSQL statement;
- exactly one `execute_sql` request for the mutation;
- no `BEGIN`/write/`COMMIT` sequence spread across requests;
- no reliance on backend-session affinity;
- no permanent RPC, function or `SECURITY DEFINER` surface;
- no database credential in the repository or generated payload.

The preparation layer canonicalizes JSON recursively by key order, encodes the canonical UTF-8 JSON as base64, and deterministically renders it in bounded base64 literal chunks. Evidence `exactText` is independently base64 encoded inside that payload. Source text is therefore never interpolated or ad-hoc escaped into SQL.

The one-statement executor decodes the payload back to `jsonb` and then fails closed unless all of the following hold before evidence writes are allowed:

- payload version and exact source repository/commit/tree match;
- exactly five source items are present;
- Class E is absent and its one-item exclusion proof is present;
- every included `occurredAt` is `null`;
- the exact deterministic source-plan fingerprint equals `b1730e1e60bbc22289c4be89862c645c5461b108fb34dff188cc96c85f488f0a`;
- every decoded evidence text hashes to its declared SHA-256 `contentHash`;
- expected Auth user/account/World ownership and the single owner membership/companion bootstrap shape match without ambiguity.

Only after those checks does the statement establish the transaction-local `transactional-v1`, World and account settings. It then performs deterministic observation/fragment inserts, reconciles every persisted evidence field against the source plan, computes a deterministic evidence fingerprint, and asserts that admission decisions, ontology nodes and assertions did not change. Guard failures are uncaught PostgreSQL errors, so the entire one-statement operation rolls back.

The approved manifest itself is unchanged by this adaptation.

## Reconciliation fingerprint invariant

The source-plan fingerprint is portable across authorized fixtures because it is derived only from the approved source plan. Its required value is:

`b1730e1e60bbc22289c4be89862c645c5461b108fb34dff188cc96c85f488f0a`

The persisted reconciliation fingerprint is intentionally **fixture-bound**. Its algorithm includes the instantiated account ID and World ID together with the persisted evidence fields. Therefore the same approved five-item evidence plan is expected to produce different reconciliation fingerprints when instantiated into different authorized account/World fixtures.

The durable invariant is:

```text
persisted-state fingerprint for fixture X
==
plan-derived fingerprint instantiated for the same account/World fixture X
```

It is explicitly **not** a cross-fixture equality requirement between staging and production.

Portable invariants that must remain identical across staging and production are the pinned source repository, source commit, source tree, source blob identities, five included source items, one Class E exclusion, evidence text/content hashes, deterministic source locators, `occurredAt = null` semantics, and the source-plan fingerprint above.

## Temporal treatment

Historical source operational day is stored separately as `local_calendar_date` when the source establishes that day.

`occurred_at` remains `NULL` when the source does not establish an authoritative physical instant. Such evidence remains `occurred_precision = 'unknown'` and Step 107 does not invoke Step 100 assignment merely to force it into an import-time operational period.

All five approved control-plane imports retain `occurred_at = NULL`. Four retain their source operational-day date; the accepted World decision has no operational-day claim.

## Identity treatment

Historical identifiers are source identities only. The planner supports deterministic explicit source→native mappings and fails closed if one source identity maps to multiple native IDs. Normalized-label collisions are reported as ambiguities rather than merged.

The earlier representative staging rehearsal additionally exercised native Step 103 identity reuse with two independently evidenced Stronghold candidates. The second admission reused the first Stronghold node and produced an assertion successor rather than a duplicate ontology node.

## Production security prerequisite

The authorized privilege-only remediation to existing production helper `public.rls_auto_enable()` remains in force:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated, service_role;
```

No function body, owner, `SECURITY DEFINER` property, `search_path`, event trigger, trigger owner, trigger enabled state, tags or automatic-RLS behavior was changed by Step 107. The accepted RealMe production foundation through Step 104 and the Warden Auth/account/World binding remain the production prerequisite for the completed Phase 3A evidence import.

## Earlier representative staging rehearsal

The earlier rehearsal imported the same five evidence items and one Class E exclusion into staging, then exercised the accepted Step 102 interpretation and Step 103 user-admission boundaries. That rehearsal produced 5 observations, 5 exact fragments, 5 jobs, 4 runs/candidates, 3 explicit admission decisions, 2 ontology nodes and 3 assertion versions, while one WBTD-derived candidate remained unresolved and non-canonical.

Its canonical fingerprint over admission decisions, ontology nodes, aliases and assertions was:

`de28c976402e3bf0809687dc633e716ed54858533f7de80bbd57643af6f36413`

The rehearsal also proved that the second independently evidenced Stronghold admission reused the first node and produced an assertion successor instead of a duplicate ontology identity. No WBTD conclusion became canonical merely through import.

## Original direct-path atomicity regression

The direct PostgreSQL path was previously exercised with a fragment collision designed to fail only after a prospective new observation write. Replay verification raised a mismatch and the explicit transaction rolled back. Observation and fragment counts/fingerprints were identical before and after, and the deliberately attempted observation was absent. An immediately following identical replay succeeded.

## Control-plane staging proof

The additive control-plane path was exercised against the non-production Supabase staging project through the same `execute_sql` primitive intended for production administration.

A clean staging World/account fixture was established with zero Step 107 observations, fragments, admission decisions, ontology nodes and assertions.

### Deliberate post-observation rollback

A deterministic artifact with `failAfterObservationInsert = true` was submitted as **one PostgreSQL statement in one `execute_sql` request**. The failpoint is downstream of the data-modifying observation CTE and explicitly consumes its result count, so the prospective observation write is evaluated before the deliberate error.

The request failed with the expected uncaught PostgreSQL error marker:

```text
STEP107_DELIBERATE_POST_OBSERVATION_FAILURE_
```

Independent read-only verification immediately afterward showed:

- observations: 0;
- source fragments: 0;
- admission decisions: 0;
- ontology nodes: 0;
- assertions: 0.

No partial durable Step 107 state survived.

### Successful first execution

The normal deterministic artifact was then submitted from the same clean fixture as one statement in one request. It returned:

- source-plan item count: 5;
- observations: 0 → 5; inserted = 5;
- source fragments: 0 → 5; inserted = 5;
- admission decisions: 0 → 0;
- ontology nodes: 0 → 0;
- assertions: 0 → 0;
- canonical/admission state unchanged: true;
- staging reconciliation fingerprint: `431f1cc28af057690410cd74b2a0f3e48b3d4e00bfd39c7dc59eaf96a81326aa`.

### Byte-identical replay

The exact same normal SQL statement was submitted again byte-for-byte through one further `execute_sql` request. It returned:

- observations: 5 → 5; inserted = 0;
- source fragments: 5 → 5; inserted = 0;
- admission decisions: 0 → 0;
- ontology nodes: 0 → 0;
- assertions: 0 → 0;
- canonical/admission state unchanged: true;
- staging reconciliation fingerprint unchanged at `431f1cc28af057690410cd74b2a0f3e48b3d4e00bfd39c7dc59eaf96a81326aa`.

This staging proof changed no schema. At the time of this staging proof, production was not used for rollback, first-run or replay testing. No new staging execution was required for the later documentation-only reconciliation clarification.

## Production Phase 3A evidence import

Production Phase 3A is classified **PASS / EVIDENCE IMPORT COMPLETE / INTERPRETATION NOT YET AUTHORIZED**.

The authorized production execution was performed once only. It returned:

- source-plan item count: 5;
- observations: 0 → 5; inserted = 5;
- source fragments: 0 → 5; inserted = 5;
- admission decisions: 0;
- ontology nodes: 0;
- assertions: 0;
- `canonicalStateUnchanged`: true.

Independent production reconciliation then instantiated the same approved source plan with the authorized production account/World identities and compared it with the persisted production evidence state. The result was:

- exact plan rows: 5;
- row mismatches: 0;
- persisted production reconciliation fingerprint: `ba9121d62d53c8a1dac628c3794eeca35c2c2bb1db58c9dfbb648dc43c2a73e8`;
- plan-derived production reconciliation fingerprint: `ba9121d62d53c8a1dac628c3794eeca35c2c2bb1db58c9dfbb648dc43c2a73e8`.

The production fingerprint differs from the staging fingerprint because the reconciliation algorithm includes account/World identity. This difference is expected and does not represent an evidence mismatch.

No production replay was performed. The five imported production observations and five source fragments must not be modified or replayed by this documentation correction.

## Scope boundary

Step 107 does not authorize or implement:

- direct historical canonical bootstrap;
- generic multi-user import UX;
- fuzzy identity matching, embeddings or confidence merging;
- new structural hierarchy semantics;
- a permanent control-plane RPC/function;
- production execution without a separate Architect authorization;
- Step 108.

Step 107 remains **OPEN / PRODUCTION EVIDENCE IMPORT COMPLETE / INTERPRETATION NOT YET AUTHORIZED / NOT ACCEPTED** pending independent Inspector acceptance-delta review and Warden acceptance. Step 108 remains unauthorized.
