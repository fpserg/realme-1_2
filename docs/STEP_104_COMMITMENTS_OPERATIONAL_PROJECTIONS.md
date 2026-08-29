# Step 104 — Commitments and Operational Projections

**Status:** OPEN / IMPLEMENTATION CANDIDATE / NOT ACCEPTED  
**Authorized base:** `aee2a1951e9c0ead46d07ef4c5924902da240fe0`  
**Accepted base tree:** `a6aa6b855aa469c58ccf3d22cf58ab46d4e21af6`

Step 104 projects admitted canonical commitment facts into bounded operational surfaces. It does not create a second truth store and does not authorize Step 105.

## Canonical representation

A commitment is an existing admitted ontology node. Its durable identity is therefore independent of wording, due date, status and projection membership.

The Step 104 projection recognizes three active scalar assertion predicates on that node:

- `commitment.title` — display wording;
- `commitment.due_local_date` — ISO civil date `YYYY-MM-DD`;
- `commitment.status` — the bounded status set `open`, `completed`, `cancelled`.

These are ordinary versioned assertions governed by the accepted Step 103 admission path. Step 104 adds no browser or projection mutation path for them. Due-date and status changes remain assertion history rather than projection updates.

## Projection semantics

`commitment_projection_source` is a disposable `security_invoker` view over current admitted assertions. It carries the canonical commitment node ID and exact assertion IDs for title, due date and status.

`list_operational_commitments(surface, horizon_days)` is the only authenticated Step 104 read command. It derives actor and World server-side, requires exactly one World membership, reads the active Step 100 time setting, and derives the current operational date from the configured timezone and operational-day boundary.

- **Today** contains open commitments whose admitted civil due date is on or before the current operational date.
- **Horizon** contains open commitments after Today through a bounded future window; the application uses 30 days and the database permits 1–90.
- **Stale/overdue** is computed when an open due date is before the current operational date. Time passing never writes canonical history.
- terminal commitments remain canonical history but do not appear in active Today/Horizon surfaces.

## Rebuild law

The projection layer contains no canonical writes. The verification fixture destroys and rebuilds the projection view inside a rollback-only transaction, checks projection equivalence before/after rebuild, and fingerprints canonical assertions to prove canonical truth is unchanged.

## Security boundary

- actor derives from `auth.uid()`;
- World derives from membership, never request input;
- projection source is not granted directly to browser roles;
- the read RPC is `SECURITY DEFINER` with empty `search_path` and exact authenticated execute grant;
- no generic canonical mutation is added;
- canonical references remain available for explanation/provenance;
- production rollout is out of scope.

## Scope boundary

No notifications, calendar integration, autonomous planning, policy/automatic admission, broad task/project-management system, Living World work, map rendering or Step 105 implementation is included.

Production `public.rls_auto_enable()` remediation remains mandatory before the first production RealMe migration and is not performed by Step 104.

Step 104 remains **OPEN / IMPLEMENTATION CANDIDATE / NOT ACCEPTED** pending independent review and Warden acceptance. Step 105 remains **NOT STARTED / NOT AUTHORIZED**.
