begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

create or replace function pg_temp.expect_rejection(
  case_name text,
  expected_state text,
  expected_constraint text,
  command text
)
returns void
language plpgsql
as $$
declare
  actual_state text;
  actual_constraint text;
begin
  begin
    execute command;
  exception
    when others then
      get stacked diagnostics
        actual_state = returned_sqlstate,
        actual_constraint = constraint_name;

      if actual_state <> expected_state then
        raise exception '%: expected SQLSTATE %, received %',
          case_name, expected_state, actual_state;
      end if;

      if expected_constraint is not null
        and actual_constraint is distinct from expected_constraint
      then
        raise exception '%: expected constraint %, received %',
          case_name, expected_constraint, actual_constraint;
      end if;

      return;
  end;

  raise exception '%: malformed state unexpectedly succeeded', case_name;
end;
$$;

insert into public.observations
  (id, world_id, recorded_by_account_id, source_kind)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    '11111111-1111-4111-8111-111111111111',
    'synthetic-review'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    '11111111-1111-4111-8111-111111111111',
    'synthetic-review'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '22222222-2222-4222-8222-222222222222'),
    '22222222-2222-4222-8222-222222222222',
    'synthetic-review'
  );

insert into public.interpretation_runs
  (id, world_id, observation_id, prompt_version, schema_version, input_hash)
values
  (
    'aaaaaaaa-1000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-0000-4000-8000-000000000001',
    'review', 'review', 'review-a'
  ),
  (
    'bbbbbbbb-1000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '22222222-2222-4222-8222-222222222222'),
    'bbbbbbbb-0000-4000-8000-000000000001',
    'review', 'review', 'review-b'
  );

insert into public.candidate_claims
  (id, world_id, interpretation_run_id, claim_kind, payload)
values
  (
    'aaaaaaaa-2000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-1000-4000-8000-000000000001', 'synthetic', '{}'::jsonb
  ),
  (
    'aaaaaaaa-2000-4000-8000-000000000002',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-1000-4000-8000-000000000001', 'synthetic', '{}'::jsonb
  ),
  (
    'bbbbbbbb-2000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '22222222-2222-4222-8222-222222222222'),
    'bbbbbbbb-1000-4000-8000-000000000001', 'synthetic', '{}'::jsonb
  );

insert into public.admission_decisions
  (id, world_id, candidate_claim_id, decision_kind, authority_kind,
   decided_by_account_id)
values
  (
    'aaaaaaaa-3000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000001', 'accept', 'user',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'bbbbbbbb-3000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '22222222-2222-4222-8222-222222222222'),
    'bbbbbbbb-2000-4000-8000-000000000001', 'accept', 'user',
    '22222222-2222-4222-8222-222222222222'
  );

insert into public.ontology_nodes
  (id, world_id, admitted_by_decision_id)
values
  (
    'aaaaaaaa-4000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-3000-4000-8000-000000000001'
  ),
  (
    'bbbbbbbb-4000-4000-8000-000000000001',
    (select id from public.worlds
      where initial_owner_id = '22222222-2222-4222-8222-222222222222'),
    'bbbbbbbb-3000-4000-8000-000000000001'
  );

select pg_temp.expect_rejection(
  'actorless admission', '23502', null,
  format(
    'insert into public.admission_decisions
       (world_id, candidate_claim_id, decision_kind, authority_kind)
     values (%L, %L, ''accept'', ''user'')',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000001'
  )
);

select pg_temp.expect_rejection(
  'policy admission', '23514', 'admission_decisions_authority_check',
  format(
    'insert into public.admission_decisions
       (world_id, candidate_claim_id, decision_kind, authority_kind,
        decided_by_account_id)
     values (%L, %L, ''accept'', ''policy'', %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111'
  )
);

select pg_temp.expect_rejection(
  'correct without payload', '23514',
  'admission_decisions_payload_coherence_check',
  format(
    'insert into public.admission_decisions
       (world_id, candidate_claim_id, decision_kind, authority_kind,
        decided_by_account_id)
     values (%L, %L, ''correct'', ''user'', %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111'
  )
);

select pg_temp.expect_rejection(
  'accept with payload', '23514',
  'admission_decisions_payload_coherence_check',
  format(
    'insert into public.admission_decisions
       (world_id, candidate_claim_id, decision_kind, authority_kind,
        decided_by_account_id, correction_payload)
     values (%L, %L, ''accept'', ''user'', %L, ''{}''::jsonb)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111'
  )
);

select pg_temp.expect_rejection(
  'cross-candidate decision supersession', '23503',
  'admission_decisions_supersedes_candidate_world_fk',
  format(
    'insert into public.admission_decisions
       (world_id, candidate_claim_id, decision_kind, authority_kind,
        decided_by_account_id, supersedes_decision_id)
     values (%L, %L, ''accept'', ''user'', %L, %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-2000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-3000-4000-8000-000000000001'
  )
);

select pg_temp.expect_rejection(
  'cross-world candidate node', '23503',
  'candidate_claims_proposed_subject_node_world_fk',
  format(
    'insert into public.candidate_claims
       (world_id, interpretation_run_id, proposed_subject_node_id,
        claim_kind, payload)
     values (%L, %L, %L, ''synthetic'', ''{}''::jsonb)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-1000-4000-8000-000000000001',
    'bbbbbbbb-4000-4000-8000-000000000001'
  )
);

select pg_temp.expect_rejection(
  'canonical object JSON', '23514', 'assertions_scalar_value_check',
  format(
    'insert into public.assertions
       (world_id, predicate, value, admitted_by_decision_id)
     values (%L, ''synthetic.object'', ''{}''::jsonb, %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-3000-4000-8000-000000000001'
  )
);

select pg_temp.expect_rejection(
  'canonical array JSON', '23514', 'assertions_scalar_value_check',
  format(
    'insert into public.assertions
       (world_id, predicate, value, admitted_by_decision_id)
     values (%L, ''synthetic.array'', ''[]''::jsonb, %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-3000-4000-8000-000000000001'
  )
);

insert into public.time_settings
  (id, world_id, timezone_name, recorded_by_account_id)
values (
  'aaaaaaaa-5000-4000-8000-000000000001',
  (select id from public.worlds
    where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
  'UTC', '11111111-1111-4111-8111-111111111111'
);

insert into public.operational_periods
  (id, world_id, time_setting_id, local_date, starts_at, ends_at)
values (
  'aaaaaaaa-6000-4000-8000-000000000001',
  (select id from public.worlds
    where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
  'aaaaaaaa-5000-4000-8000-000000000001', date '2026-08-20',
  timestamptz '2026-08-20 04:00:00+00',
  timestamptz '2026-08-21 04:00:00+00'
);

select pg_temp.expect_rejection(
  'correction without predecessor', '23514',
  'observation_operational_memberships_correction_chain_check',
  format(
    'insert into public.observation_operational_period_memberships
       (world_id, observation_id, operational_period_id, assignment_kind)
     values (%L, %L, %L, ''correction'')',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-6000-4000-8000-000000000001'
  )
);

insert into public.observation_operational_period_memberships
  (id, world_id, observation_id, operational_period_id, assignment_kind)
values (
  'aaaaaaaa-7000-4000-8000-000000000001',
  (select id from public.worlds
    where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-6000-4000-8000-000000000001', 'initial'
);

select pg_temp.expect_rejection(
  'second initial membership', '23505',
  'observation_operational_membership_initial_unique',
  format(
    'insert into public.observation_operational_period_memberships
       (world_id, observation_id, operational_period_id, assignment_kind)
     values (%L, %L, %L, ''initial'')',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-6000-4000-8000-000000000001'
  )
);

insert into public.observation_operational_period_memberships
  (id, world_id, observation_id, operational_period_id, assignment_kind,
   supersedes_membership_id)
values (
  'aaaaaaaa-7000-4000-8000-000000000002',
  (select id from public.worlds
    where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-6000-4000-8000-000000000001', 'correction',
  'aaaaaaaa-7000-4000-8000-000000000001'
);

select pg_temp.expect_rejection(
  'forked operational correction', '23505',
  'observation_operational_membership_successor_unique',
  format(
    'insert into public.observation_operational_period_memberships
       (world_id, observation_id, operational_period_id, assignment_kind,
        supersedes_membership_id)
     values (%L, %L, %L, ''correction'', %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-6000-4000-8000-000000000001',
    'aaaaaaaa-7000-4000-8000-000000000001'
  )
);

select pg_temp.expect_rejection(
  'cross-observation correction', '23503',
  'observation_operational_membership_supersedes_observation_world',
  format(
    'insert into public.observation_operational_period_memberships
       (world_id, observation_id, operational_period_id, assignment_kind,
        supersedes_membership_id)
     values (%L, %L, %L, ''correction'', %L)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111'),
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-6000-4000-8000-000000000001',
    'aaaaaaaa-7000-4000-8000-000000000002'
  )
);

select pg_temp.expect_rejection(
  'attempts above maximum', '23514', 'jobs_attempts_within_max_check',
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts)
     values (%L, ''synthetic'', ''attempts-over-max'', ''failed'', 6, 5)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

select pg_temp.expect_rejection(
  'locked queued job', '23514', null,
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts,
        locked_at)
     values (%L, ''synthetic'', ''queued-locked'', ''queued'', 0, 5, now())',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

select pg_temp.expect_rejection(
  'exhausted queued job', '23514', 'jobs_queued_state_check',
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts)
     values (%L, ''synthetic'', ''queued-exhausted'', ''queued'', 5, 5)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

select pg_temp.expect_rejection(
  'unlocked running job', '23514', 'jobs_running_state_check',
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts)
     values (%L, ''synthetic'', ''running-unlocked'', ''running'', 1, 5)',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

select pg_temp.expect_rejection(
  'zero-attempt running job', '23514', 'jobs_running_state_check',
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts,
        locked_at)
     values (%L, ''synthetic'', ''running-zero'', ''running'', 0, 5, now())',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

select pg_temp.expect_rejection(
  'locked non-running job', '23514', 'jobs_non_running_unlocked_check',
  format(
    'insert into public.jobs
       (world_id, job_kind, idempotency_key, status, attempts, max_attempts,
        locked_at)
     values (%L, ''synthetic'', ''succeeded-locked'', ''succeeded'', 1, 5,
             now())',
    (select id from public.worlds
      where initial_owner_id = '11111111-1111-4111-8111-111111111111')
  )
);

rollback;
