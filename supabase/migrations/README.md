# Database migrations

Drizzle generates reviewed, timestamp-prefixed SQL migrations in this directory. Shared environments apply committed migrations through CI; `drizzle-kit push` is not an accepted shared-environment workflow.

No product table is introduced during Step 96.

`20260817002110_step_97_identity_and_world_ownership.sql` is the first bounded
product migration. It contains only authentication-adjacent account identity,
World ownership/membership, one-companion bootstrap and deny-by-default RLS.
Canonical observations, interpretation, admission, ontology and temporal state
remain outside this migration and belong to later accepted roadmap steps.
