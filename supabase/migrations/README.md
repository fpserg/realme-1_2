# Database migrations

Drizzle generates reviewed, timestamp-prefixed SQL migrations in this directory. Shared environments apply committed migrations through CI; `drizzle-kit push` is not an accepted shared-environment workflow.

No product table is introduced during Step 96.

`20260817002310_step_97_identity_and_world_ownership.sql` is the first bounded
product migration. It contains only authentication-adjacent account identity,
World ownership/membership, one-companion bootstrap and deny-by-default RLS.
Canonical observations, interpretation, admission, ontology and temporal state
remain outside the Step 97 migration.

Step 98 is an unaccepted implementation candidate comprising three exact,
staging-applied migrations:

- `20260820095459_step_98_canonical_truth_schema.sql` introduces separate
  evidence, interpretation, decision, admitted World Model, temporal, job and
  audit records;
- `20260820095634_step_98_internal_table_denials.sql` makes the hidden internal
  API boundary explicitly deny all public clients;
- `20260820100146_step_98_admission_invariants.sql` prevents rejected or
  deferred decisions from creating canonical ontology or assertion records.

Production remains unmigrated. These migrations do not authorize Step 99,
direct client writes, AI processing, personal data or legacy runtime seed.
