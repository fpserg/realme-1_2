begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

create or replace function pg_temp.expect_rejection(case_name text, command text)
returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    return;
  end;
  raise exception '% unexpectedly succeeded', case_name;
end;
$$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
create temporary table step_102_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000102',
  'Synthetic exact evidence for Step 102'
);
select * from public.save_time_setting('UTC', '04:00');
create temporary table step_102_temporal as
select * from public.assign_observation_operational_period(
  (select observation_id from step_102_capture)
);

-- duplicate enqueue
create temporary table step_102_enqueue_first as
select * from public.enqueue_observation_interpretation(
  (select observation_id from step_102_capture)
);
create temporary table step_102_enqueue_second as
select * from public.enqueue_observation_interpretation(
  (select observation_id from step_102_capture)
);

do $$
begin
  assert (select job_id from step_102_enqueue_first) =
    (select job_id from step_102_enqueue_second);
  assert (select was_created from step_102_enqueue_first);
  assert not (select was_created from step_102_enqueue_second);
  assert (
    select count(*) from public.jobs
    where observation_id = (select observation_id from step_102_capture)
  ) = 1;
end;
$$;

-- cross-world enqueue
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select pg_temp.expect_rejection(
  'cross-world enqueue',
  format(
    'select * from public.enqueue_observation_interpretation(%L::uuid)',
    (select observation_id from step_102_capture)
  )
);
create temporary table step_102_other_capture as
select * from public.capture_text_observation(
  'bbbbbbbb-0000-4000-8000-000000000102',
  'Synthetic evidence owned by another World'
);

-- hidden client tables
set local role authenticated;
select pg_temp.expect_rejection('hidden client tables', 'select * from public.jobs');
select pg_temp.expect_rejection('hidden client runs', 'select * from public.interpretation_runs');
select pg_temp.expect_rejection('hidden client candidates', 'select * from public.candidate_claims');
reset role;

create temporary table canonical_counts as
select
  (select count(*) from public.admission_decisions) as decisions,
  (select count(*) from public.ontology_nodes) as nodes,
  (select count(*) from public.ontology_relationships) as relationships,
  (select count(*) from public.assertions) as assertions;

update public.jobs
set status = 'running', attempts = 1, locked_at = clock_timestamp(),
    lock_token = '33333333-3333-4333-8333-333333333333'
where id = (select job_id from step_102_enqueue_first);

insert into public.interpretation_runs (
  world_id, job_id, observation_id, attempt_number, status,
  provider, model, prompt_version, schema_version, input_hash, started_at
)
select world_id, id, observation_id, 1, 'running',
       'fixture', 'fixture-model', 'interpret-observation-v1',
       'candidate-set-v1', repeat('a', 64), clock_timestamp()
from public.jobs where id = (select job_id from step_102_enqueue_first);

create temporary table step_102_candidate (id uuid, world_id uuid);
with inserted_candidate as (
  insert into public.candidate_claims (
    world_id, interpretation_run_id, job_id, logical_key,
    claim_kind, payload
  )
  select run.world_id, run.id, run.job_id, repeat('b', 64), 'proposition',
         jsonb_build_object(
           'subject', 'user', 'predicate', 'focused_on',
           'object', 'synthetic_model',
           'explanation', 'Synthetic bounded explanation.',
           'confidence', 0.7, 'schema_version', 'candidate-set-v1'
         )
  from public.interpretation_runs as run
  where run.job_id = (select job_id from step_102_enqueue_first)
  returning id, world_id
)
insert into step_102_candidate select id, world_id from inserted_candidate;

-- exact evidence link
insert into public.candidate_claim_evidence (
  world_id, candidate_claim_id, source_fragment_id
)
select candidate.world_id, candidate.id, fragment.id
from step_102_candidate as candidate
join public.source_fragments as fragment
  on fragment.observation_id = (select observation_id from step_102_capture)
 and fragment.ordinal = 0;

do $$
begin
  assert exists (
    select 1 from public.candidate_claim_evidence
    where candidate_claim_id = (select id from step_102_candidate)
  );
end;
$$;

-- cross-world exact evidence link
select pg_temp.expect_rejection(
  'cross-world exact evidence link',
  format(
    $command$insert into public.candidate_claim_evidence
      (world_id, candidate_claim_id, source_fragment_id)
      select candidate.world_id, candidate.id, fragment.id
      from step_102_candidate as candidate
      cross join public.source_fragments as fragment
      where fragment.observation_id = %L::uuid$command$,
    (select observation_id from step_102_other_capture)
  )
);

-- duplicate candidate
select pg_temp.expect_rejection(
  'duplicate candidate',
  format(
    $command$insert into public.candidate_claims
      (world_id, interpretation_run_id, job_id, logical_key, claim_kind, payload)
      select world_id, interpretation_run_id, job_id, logical_key, claim_kind, payload
      from public.candidate_claims where id = %L::uuid$command$,
    (select id from step_102_candidate)
  )
);

-- invalid candidate payload
select pg_temp.expect_rejection(
  'invalid candidate payload',
  format(
    $command$insert into public.candidate_claims
      (world_id, interpretation_run_id, job_id, logical_key, claim_kind, payload)
      select world_id, interpretation_run_id, job_id, repeat('c', 64), claim_kind,
             payload || '{"unexpected":"write_assertion"}'::jsonb
      from public.candidate_claims where id = %L::uuid$command$,
    (select id from step_102_candidate)
  )
);

update public.interpretation_runs
set status = 'succeeded', completed_at = clock_timestamp()
where job_id = (select job_id from step_102_enqueue_first);
update public.jobs
set status = 'succeeded', locked_at = null, lock_token = null
where id = (select job_id from step_102_enqueue_first);

-- canonical non-mutation
do $$
begin
  assert (select count(*) from public.admission_decisions) =
    (select decisions from canonical_counts);
  assert (select count(*) from public.ontology_nodes) =
    (select nodes from canonical_counts);
  assert (select count(*) from public.ontology_relationships) =
    (select relationships from canonical_counts);
  assert (select count(*) from public.assertions) =
    (select assertions from canonical_counts);
end;
$$;

-- observation survives failure
do $$
begin
  assert exists (
    select 1 from public.observations
    where id = (select observation_id from step_102_capture)
  );
  assert exists (
    select 1 from public.source_fragments
    where observation_id = (select observation_id from step_102_capture)
  );
  assert exists (
    select 1 from public.observation_operational_period_memberships
    where observation_id = (select observation_id from step_102_capture)
  );
end;
$$;

rollback;
