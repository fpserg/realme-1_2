# RealMe 1.2 — Step 100 Native Temporal Continuity

Version: 0.1

Status: OPEN / IMPLEMENTATION CANDIDATE / NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-21

Risk: Tier H — temporal interpretation, historical assignment and Today semantics

## 1. Bounded outcome

Step 100 activates the temporal structures accepted in Step 98 without
weakening Step 99 persist-first evidence.

The candidate provides:

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
3. `20260820214147_step_100_setting_monotonic_clock_correction`.

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

The SQL migrations, Drizzle journal and Drizzle snapshots preserve all three
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

The database converts each local boundary independently with `AT TIME ZONE`.
It does not add a fixed 24-hour interval. A 04:00-to-04:00 period can therefore
last 23, 24 or 25 physical hours across DST transitions while retaining an
unambiguous UTC start and end.

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

## 10. Verification gate

Before Warden consideration, the candidate must:

1. pass formatting, ESLint, strict TypeScript, architecture boundaries,
   Drizzle consistency, unit/enforcement tests and production build;
2. pass mobile Chromium capture → automatic placement → Today → reload;
3. retain exact Step 97–99 migration history and apply all Step 100 migrations
   only to synthetic staging;
4. pass the rollback-only temporal regression covering IANA validation, 04:00
   date behavior, both DST transitions, interval non-overlap, idempotent
   periods and membership, late evidence, prospective changes, explicit
   correction, strict audit metadata, failure survival and cross-World denial;
5. leave staging with zero Auth users and zero product rows;
6. verify all product tables retain RLS and inspect every exact privileged
   function signature and grant;
7. classify Supabase security and performance advisors;
8. confirm production remains unmigrated and untouched;
9. obtain exact-head GitHub Actions and Netlify preview success;
10. obtain independent Inspector review and explicit Warden acceptance.

## 11. Preserved deferred boundaries

Production remains unmigrated. The pre-existing production
`public.rls_auto_enable()` execution-grant warnings remain mandatory remediation
before the first RealMe production migration.

The Step 100 historical-correction writer activates an action-specific strict
audit metadata allow-list. This does not create a generic audit-writing API.

Step 100 remains open and unaccepted. The draft PR must remain unmerged. Step
101 is not started and requires separate Warden authorization.
