# RealMe 1.2 — Step 100 Native Temporal Continuity

Version: 1.0

Status: ACCEPTED — STEP 100 COMPLETE

Opened by: Warden

Opened on: 2026-08-21

Accepted by: Warden

Accepted on: 2026-08-21

Risk: Tier H — temporal interpretation, historical assignment and Today semantics

## 1. Bounded outcome

Step 100 activates the temporal structures accepted in Step 98 without
weakening Step 99 persist-first evidence.

The accepted implementation provides:

- an explicitly accepted, durable IANA timezone;
- the constitutional default 04:00 local operational boundary;
- append-version time settings with non-overlapping effective intervals;
- DST-aware, deterministic operational periods;
- retry-safe automatic initial observation membership;
- late-observation assignment from the effective event instant;
- prospective setting changes that leave historical membership untouched;
- explicit append-only historical membership correction with bounded audit
  metadata;
- an initial evidence-level Today timeline rebuilt from persisted truth.

Step 100 does not implement companion dialogue, AI, interpretation jobs,
candidate claims, admission, commitments, Horizon, the later Step 104
projection system, Living World behavior, production rollout or personal-data
import. Step 101 has not started.

## 2. Migration identities

The forward Step 100 migrations are:

1. `20260820213941_step_100_native_temporal_continuity`;
2. `20260820214041_step_100_period_conflict_correction`;
3. `20260820214147_step_100_setting_monotonic_clock_correction`;
4. `20260820223440_step_100_dst_civil_boundary_correction`.

The first migration introduced the durable constraints, internal helpers and
four narrow authenticated commands. Synthetic staging then exposed a
PL/pgSQL output-name ambiguity in the internal period helper. Because the
first migration had already been recorded, the implementation preserved its
identity and corrected the helper forward-only in the second migration.

Rollback-only staging verification then exercised two setting changes within
one transaction and exposed `statement_timestamp()` reuse. The third
forward-only migration changed the setting command to database wall-clock time
with a one-microsecond monotonic floor relative to its predecessor. No accepted
Step 97–99 migration was rewritten.

Independent Inspector review then identified a disagreement for configurable
boundaries inside a daylight-saving gap or fold. The fourth forward-only
migration makes the civil-boundary policy explicit and replaces nominal
wall-clock subtraction with physical period containment. It does not change
the four reviewed public command signatures.

The SQL migrations, Drizzle journal and Drizzle snapshots preserve all four
identities.

## 3. Time-setting versions

`public.save_time_setting(text, time)` derives actor and World from
`auth.uid()` and the initial-owner membership. It accepts only a PostgreSQL
IANA timezone name and a local wall-clock boundary.

The initial accepted setting begins at negative infinity so late evidence from
before account creation still has one explicit governing initial rule. Every
later change:

1. locks the World and current open setting;
2. closes only the prior `effective_to`;
3. appends one successor with server-controlled effective time;
4. leaves prior setting identity and content immutable.

A GiST exclusion constraint prevents effective-interval overlap. Partial
unique indexes permit one open version, one root and one direct successor.
The validation trigger permits an existing version only to transition once
from open to closed; timezone, boundary, provenance and effective start are
not mutable.

The browser timezone is a suggestion only. It is persisted only after the user
submits the time-setting form. A later device timezone never overwrites the
durable setting automatically.

## 4. DST and operational periods

Operational periods are constructed from:

- the exact `time_setting_id`;
- its IANA timezone;
- its local wall-clock boundary;
- its local operational date.

Each configured boundary is resolved as local civil time under one explicit
database-authoritative policy:

- an ordinary local time maps to its sole physical instant;
- a nonexistent spring-gap time moves forward by the size of the gap while
  preserving its wall-clock position within the gap;
- a repeated fall-fold time chooses the earlier physical occurrence.

For example, Amsterdam `2026-03-29 02:30` resolves forward to `03:30` local,
or `2026-03-29T01:30:00Z`. Amsterdam `2026-10-25 02:30` selects the earlier
occurrence, `2026-10-25T00:30:00Z`.

An operational period is exactly the half-open interval between independently
resolved boundaries on its local date and the following local date. The engine
does not add a fixed 24-hour interval. A period can therefore last 23, 24 or 25
physical hours across DST transitions while retaining unambiguous UTC endpoints.

`(time_setting_id, local_date)` is unique. The internal constructor inserts
with conflict-safe reuse, so repeated requests return one stable period
identity.

## 5. Temporal anchor and late evidence

Initial membership uses this persisted anchor order:

1. the unique leaf of the occurred-time correction supersession chain;
2. original `observations.occurred_at`;
3. database-controlled `observations.recorded_at`.

The engine never infers semantic latest state from correction timestamps. A
malformed correction chain fails safely.

The setting version is selected by the event anchor's effective interval.
Late evidence therefore enters its historical period under the historical
setting even after newer settings and periods exist. No day is reopened or
unfrozen.

Operational membership is selected from the actual resolved period boundaries,
not by subtracting the nominal boundary from the anchor's local wall-clock
value. The database constructs the adjacent candidate periods and requires
exactly one to satisfy:

`period.starts_at <= temporal_anchor < period.ends_at`

Zero or multiple matches fail safely. The period constructor and membership
resolver use the same civil-boundary primitive, so a membership whose period
does not physically contain its anchor is never written by a Step 100 command.
The TypeScript helper implements the same gap, fold and containment semantics,
while PostgreSQL remains authoritative for persisted assignment.

## 6. Persist-first automatic assignment

Evidence capture and temporal assignment remain separate database
transactions.

```text
observation + exact fragment committed
  → initial temporal assignment attempted
    → assigned, or truthful pending state
      → deterministic retry on reload
```

`public.assign_observation_operational_period(uuid)` derives actor and World,
locks only the caller's observation, resolves its target, creates/reuses the
period and inserts at most one initial membership. Retry returns the existing
effective membership and cannot duplicate membership or period identity.

If no setting exists or assignment otherwise fails, the observation remains
saved. The UI reports temporal placement as pending; later reload retries the
same deterministic command. There is no Freeze, Close Day or manual rollover.

## 7. Prospective change and historical correction

A time-setting change affects rule selection prospectively. It never edits,
deletes or mass-regenerates existing observation memberships.

If a later occurred-time correction points to a different period,
`assign_observation_operational_period` returns `correction_required` without
changing membership. The UI then offers a separate explicit action.

`public.correct_observation_operational_period(uuid, text)` accepts only the
reason categories `occurred_time_correction` and `user_review`. It appends one
`assignment_kind = 'correction'` membership that supersedes the unique prior
leaf. The earlier membership and period remain intact.

The same transaction writes `observation_operational_period_corrected` to
`audit_events`. Its schema check and command-built JSON permit exactly:

- prior membership ID;
- prior operational-period ID;
- successor membership ID;
- successor operational-period ID;
- reason category.

Observation text, source fragments, caller-provided JSON and unexpected keys
are excluded.

## 8. Today

Initial Today is a rebuildable evidence timeline, not a second mutable list.
It contains observations whose unique effective operational membership names
the server-resolved current operational period.

The UI presents exact captured text, effective occurred time when available,
recorded time and temporal placement state. It adds no commitments, tasks,
planning, summaries, candidates or ontology classifications.

The current period is resolved from database/server time, the currently
effective setting, its IANA timezone and local boundary. The browser clock is
not authoritative.

## 9. Authorization

The four Step 100 public commands are:

- `public.save_time_setting(text, time)`;
- `public.get_current_operational_period()`;
- `public.assign_observation_operational_period(uuid)`;
- `public.correct_observation_operational_period(uuid, text)`.

Each exact signature is Tier H review surface. Each uses `SECURITY DEFINER`, an
empty search path, schema-qualified objects, `auth.uid()` authority, initial
owner World derivation, no dynamic SQL and exact grants to `authenticated`
after revocation from `PUBLIC`, `anon` and `authenticated`.

Generic authenticated insert, update and delete privileges remain denied on
time settings, periods, memberships, observations and audit events. RLS
continues to isolate temporal reads by World.

## 10. Acceptance verification gate

Before acceptance, the candidate had to:

1. pass formatting, ESLint, strict TypeScript, architecture boundaries,
   Drizzle consistency, unit/enforcement tests and production build;
2. pass mobile Chromium capture → automatic placement → Today → reload;
3. retain exact Step 97–99 migration history and apply all Step 100 migrations
   only to synthetic staging;
4. pass the rollback-only temporal regression covering IANA validation, 04:00
   date behavior, spring-gap forward normalization, earlier fall-fold
   selection, physical membership containment, interval non-overlap,
   idempotent periods and membership, late evidence, prospective changes,
   explicit correction, strict audit metadata, failure survival and
   cross-World denial;
5. leave staging with zero Auth users and zero product rows;
6. verify all product tables retain RLS and inspect every exact privileged
   function signature and grant;
7. classify Supabase security and performance advisors;
8. confirm production remains unmigrated and untouched;
9. obtain exact-head GitHub Actions and Netlify preview success;
10. obtain independent Inspector review and explicit Warden acceptance.

Exact-head GitHub Actions run 95 and the Netlify Deploy Preview succeeded after
the DST correction was committed and published. Local verification passed
formatting, ESLint, strict TypeScript, architecture-boundary enforcement,
Drizzle consistency, 19 test files with 78 tests and a production build.

Synthetic staging contained the exact ten-migration history ending with
`20260820223440_step_100_dst_civil_boundary_correction`. Rollback-only temporal
verification passed, all 24 product tables retained RLS, generic authenticated
temporal writes remained denied and staging was restored to zero Auth users
and zero product rows. Production remained unchanged with zero migrations,
zero public tables and zero Auth users.

## 11. Acceptance record and preserved boundaries

Independent Inspector review returned `APPROVE` for exact implementation head
`6c8ef13c3775d28e963cd0010b57cc17e6e32155`, tree
`3a350fa316433d5be45e68afc847e8423b46ae21`, against base/main
`c340d4680fe05b4a7b1f4c0191271345d688b249`. GitHub Actions run 95 and the
Netlify Deploy Preview passed at that exact head.

The Warden explicitly accepted Step 100 at that reviewed head and tree on
2026-08-21. Acceptance preserves these laws:

- time settings are append-only versions carrying prospective IANA timezone
  and local-boundary rules;
- the default operational boundary is 04:00 local;
- nonexistent DST boundaries resolve forward by the gap and repeated
  boundaries select the earlier physical occurrence;
- every effective operational membership obeys
  `starts_at <= temporal_anchor < ends_at`;
- setting changes never silently rewrite historical memberships;
- late observations select the setting version effective at their event
  instant;
- temporal assignment remains subordinate to persist-first evidence and its
  failure cannot erase a saved observation;
- historical membership correction is explicit, append-only and audited in
  the same transaction with bounded metadata;
- Today is derived from persisted evidence and effective membership rather
  than stored as separate mutable truth;
- no manual Freeze or Close Day ritual exists.

Production remains unmigrated. The pre-existing production
`public.rls_auto_enable()` execution-grant warnings remain mandatory remediation
before the first RealMe production migration.

The Step 100 historical-correction writer activates an action-specific strict
audit metadata allow-list. This does not create a generic audit-writing API.

Step 100 is accepted and complete. PR #18 remains draft and unmerged pending
narrow acceptance-delta verification. Step 101 is not started and requires
separate Warden authorization.
